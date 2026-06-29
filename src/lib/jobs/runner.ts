import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  branches,
  deployRequests,
  goldens,
  jobKind,
  jobs,
  maskingPolicies,
  maskingRules,
} from "@/db/schema";
import { env } from "@/lib/env";
import { getConfig, branchDatabaseUrl } from "@/lib/config";
import { logEvent } from "@/lib/events";
import { getProvisioner } from "@/lib/provisioner";
import { buildMaskingStatements } from "@/lib/masking/engine";
import { computeSchemaDiff } from "@/lib/schema-diff/diff";
import { diffGoldenVsClone } from "@/lib/schema-diff/introspect";
import { decrementLineage } from "@/lib/lineage";
import { wirePreview } from "@/lib/integrations/vercel";
import { postPrComment } from "@/lib/integrations/github";

type JobKindValue = (typeof jobKind.enumValues)[number];

// Empties every public table so a schema-only branch carries no rows (and no
// production data ever survives on the clone).
const TRUNCATE_ALL_PUBLIC =
  "DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename); END LOOP; END $$;";

// Re-check a clone that is still waiting for its instance every 10s.
const POLL_INTERVAL_MS = 10_000;
// Give up on a clone whose instance never comes online. Real Serverless v2
// instance creation can take ~10 min, so allow generous headroom.
const PROVISION_TIMEOUT_MS = 20 * 60_000;
// Auto-reclaim the Aurora clone of a branch left in `error` this long.
const ERROR_GRACE_MS = 60 * 60_000;

type ProvisionOutcome = "pending" | "done";

const safe = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch {
    /* best effort: integrations must not break provisioning */
  }
};

async function getMaskingRules(projectId: string) {
  return db
    .select({
      tableName: maskingRules.tableName,
      columnName: maskingRules.columnName,
      fn: maskingRules.fn,
    })
    .from(maskingRules)
    .innerJoin(maskingPolicies, eq(maskingRules.policyId, maskingPolicies.id))
    .where(eq(maskingPolicies.projectId, projectId));
}

/**
 * Resumable provisioning state machine. Each call advances as far as it can
 * without blocking and returns "pending" while the clone instance is still
 * coming online (a worker tick re-runs it). Cloning the instance is the only
 * minutes-long step; everything else runs in one pass once the host is up.
 */
export async function runProvision(branchId: string): Promise<ProvisionOutcome> {
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, branchId));
  if (!branch) return "done";
  if (branch.status === "ready" || branch.status === "deleted") return "done";

  const provisioner = await getProvisioner();
  const config = await getConfig();
  try {
    let clusterId = branch.auroraClusterId;
    let instanceId = branch.instanceId;
    let host = branch.connectionHost;

    // Phase 1: issue the copy-on-write clone (returns immediately, no wait).
    if (!clusterId || !instanceId) {
      const golden = branch.goldenId
        ? (await db.select().from(goldens).where(eq(goldens.id, branch.goldenId)))[0]
        : undefined;
      const started = await provisioner.startClone({
        branchId,
        goldenClusterId: golden?.auroraClusterId ?? "golden",
        label: golden?.label ?? "golden",
      });
      clusterId = started.clusterId;
      instanceId = started.instanceId;
      await db
        .update(branches)
        .set({
          auroraClusterId: clusterId,
          instanceId,
          status: "provisioning",
          statusDetail: "cloning — waiting for instance",
        })
        .where(eq(branches.id, branchId));
    }

    // Phase 2: wait (polled) for the new instance to become available.
    if (!host) {
      const status = await provisioner.getCloneStatus({ clusterId, instanceId });
      if (!status.ready || !status.host) {
        if (Date.now() - branch.createdAt.getTime() > PROVISION_TIMEOUT_MS) {
          throw new Error("Timed out waiting for the clone instance.");
        }
        await db
          .update(branches)
          .set({ statusDetail: "waiting for instance" })
          .where(eq(branches.id, branchId));
        return "pending";
      }
      host = status.host;
      await db
        .update(branches)
        .set({ connectionHost: host, status: "migrating", statusDetail: "clone ready" })
        .where(eq(branches.id, branchId));
      await logEvent(branchId, "cloned", { clusterId });
    }

    // Phase 3: data + migration + ready (host is up; all quick from here).
    // Materialize the clone's data per mode BEFORE the migration (so masking
    // runs on the prod-shaped schema). Invariant: no mode may leave unmasked
    // production data on the clone.
    if (branch.dataMode === "schema_only") {
      await db
        .update(branches)
        .set({ status: "masking", statusDetail: "clearing data" })
        .where(eq(branches.id, branchId));
      await provisioner.runSql({
        host,
        statements: [TRUNCATE_ALL_PUBLIC],
        ignoreErrors: true,
      });
      await logEvent(branchId, "masked", { mode: "schema_only" });
    } else {
      // Masked clone (default). Tolerates rules whose columns a later
      // migration removes.
      await db
        .update(branches)
        .set({ status: "masking", statusDetail: "anonymizing PII" })
        .where(eq(branches.id, branchId));
      const rules = await getMaskingRules(branch.projectId);
      const statements = buildMaskingStatements(rules);
      if (statements.length) {
        await provisioner.runSql({ host, statements, ignoreErrors: true });
      }
      await logEvent(branchId, "masked", { columns: rules.length });
    }

    // Then apply the PR's migration to the clone (schema now differs from prod).
    if (branch.migrationSql) {
      await db
        .update(branches)
        .set({ status: "migrating", statusDetail: "applying migration" })
        .where(eq(branches.id, branchId));
      await provisioner.runSql({ host, statements: [branch.migrationSql] });
      await logEvent(branchId, "migrated", {});
    }

    const secretRef = `${provisioner.kind}:secret:${branchId.slice(0, 8)}`;
    const databaseUrl = branchDatabaseUrl(host, config);

    // Wiring the preview is automatic ONLY in auto-provision mode (PR webhook).
    // In manual mode you wire a branch to a preview deliberately.
    if (config.autoProvision) {
      await safe(() => wirePreview(branch.gitBranch, databaseUrl));
    }
    await safe(() =>
      postPrComment(
        config.githubRepo ?? null,
        branch.prNumber,
        `Scion branch ready for \`${branch.gitBranch}\`, masked clone on Aurora.`,
      ),
    );

    await db
      .update(branches)
      .set({
        status: "ready",
        statusDetail: null,
        secretRef,
        costCents: 2,
        leaseExpiresAt: new Date(Date.now() + env.DEMO_TTL_MINUTES * 60_000),
      })
      .where(eq(branches.id, branchId));
    await logEvent(branchId, "ready", {});

    // Open a deploy request with the real schema diff (clone vs golden).
    if (branch.migrationSql) {
      let diff;
      if (provisioner.kind === "aws" && config.goldenHost) {
        try {
          diff = await diffGoldenVsClone(config.goldenHost, host, config);
        } catch {
          diff = computeSchemaDiff(branch.migrationSql);
        }
      } else {
        diff = computeSchemaDiff(branch.migrationSql);
      }
      await db.insert(deployRequests).values({
        branchId,
        prNumber: branch.prNumber,
        baseRef: "prod",
        headRef: branch.gitBranch,
        diffSql: diff.diffSql,
        migrationSql: branch.migrationSql,
        migrationDownSql: branch.migrationDownSql,
        hasDestructive: diff.hasDestructive,
        lintFindings: diff.lint,
        status: "open",
      });
      await logEvent(branchId, "deploy_request_opened", {});
    }
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(branches)
      .set({ status: "error", statusDetail: message })
      .where(eq(branches.id, branchId));
    await logEvent(branchId, "error", { message });
    return "done";
  }
}

export async function runTeardown(branchId: string) {
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, branchId));
  if (!branch || branch.status === "deleted") return;

  await db
    .update(branches)
    .set({ status: "tearing_down", statusDetail: null })
    .where(eq(branches.id, branchId));

  const provisioner = await getProvisioner();
  if (branch.auroraClusterId && branch.instanceId) {
    await provisioner.teardown({
      clusterId: branch.auroraClusterId,
      instanceId: branch.instanceId,
    });
  }
  if (branch.goldenId) await decrementLineage(branch.goldenId);

  await db
    .update(branches)
    .set({ status: "deleted", costCents: 0, leaseExpiresAt: null })
    .where(eq(branches.id, branchId));

  // A pruned branch can no longer back a schema change that never shipped.
  // Close out any still-pending deploy request so it stops appearing as open.
  const closed = await db
    .update(deployRequests)
    .set({ status: "rejected" })
    .where(
      and(
        eq(deployRequests.branchId, branchId),
        inArray(deployRequests.status, ["open", "approved"]),
      ),
    )
    .returning({ id: deployRequests.id });
  if (closed.length) {
    await logEvent(branchId, "deploy_request_cancelled", {
      reason: "branch pruned",
    });
  }

  await logEvent(branchId, "torn_down", {});
}

export async function runReset(branchId: string) {
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, branchId));
  if (!branch) return;

  // Drop the old clone (fire-and-forget delete on AWS) and clear its identity
  // so the provision state machine starts a fresh clone. The lineage slot is
  // reused, so we neither increment nor decrement it.
  const provisioner = await getProvisioner();
  if (branch.auroraClusterId && branch.instanceId) {
    await provisioner
      .teardown({
        clusterId: branch.auroraClusterId,
        instanceId: branch.instanceId,
      })
      .catch(() => undefined);
  }
  await db
    .update(branches)
    .set({
      status: "provisioning",
      statusDetail: "re-cloning from prod",
      auroraClusterId: null,
      instanceId: null,
      connectionHost: null,
      secretRef: null,
    })
    .where(eq(branches.id, branchId));
  await logEvent(branchId, "reset", {});
  await enqueue("provision", branchId);
}

export async function enqueue(
  kind: JobKindValue,
  branchId: string,
  payload?: Record<string, unknown>,
  delayMs = 0,
) {
  await db.insert(jobs).values({
    kind,
    branchId,
    payload: payload ?? null,
    runAfter: new Date(Date.now() + delayMs),
  });
}

export async function processDue(limit = 5) {
  const due = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "queued"), lte(jobs.runAfter, new Date())))
    .orderBy(jobs.createdAt)
    .limit(limit);

  for (const job of due) {
    const claimed = await db
      .update(jobs)
      .set({ status: "running", attempts: sql`${jobs.attempts} + 1` })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "queued")))
      .returning({ id: jobs.id });
    if (!claimed.length || !job.branchId) continue;

    try {
      let outcome: ProvisionOutcome = "done";
      if (job.kind === "provision") outcome = await runProvision(job.branchId);
      else if (job.kind === "teardown") await runTeardown(job.branchId);

      if (outcome === "pending") {
        // Clone still coming online, requeue for the next poll.
        await db
          .update(jobs)
          .set({
            status: "queued",
            runAfter: new Date(Date.now() + POLL_INTERVAL_MS),
          })
          .where(eq(jobs.id, job.id));
      } else {
        await db.update(jobs).set({ status: "done" }).where(eq(jobs.id, job.id));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(jobs)
        .set({ status: "failed", lastError: message })
        .where(eq(jobs.id, job.id));
    }
  }
  return due.length;
}

export async function sweepExpiredLeases() {
  const expired = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        inArray(branches.status, ["ready", "paused"]),
        lte(branches.leaseExpiresAt, new Date()),
      ),
    );
  for (const b of expired) await enqueue("teardown", b.id);
  return expired.length;
}

/**
 * Closes deploy requests left pending by a branch that was already pruned
 * (self-healing for rows torn down before the cancel-on-teardown logic, and a
 * safety net if a teardown updated the branch but not its request).
 */
export async function closeOrphanedDeployRequests() {
  const deletedBranchIds = db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.status, "deleted"));
  const closed = await db
    .update(deployRequests)
    .set({ status: "rejected" })
    .where(
      and(
        inArray(deployRequests.status, ["open", "approved"]),
        inArray(deployRequests.branchId, deletedBranchIds),
      ),
    )
    .returning({ branchId: deployRequests.branchId });
  for (const r of closed) {
    await logEvent(r.branchId, "deploy_request_cancelled", {
      reason: "branch pruned",
    });
  }
  return closed.length;
}

/** Reclaims the Aurora clone of any branch stuck in `error` past the grace. */
export async function sweepErroredBranches() {
  const cutoff = new Date(Date.now() - ERROR_GRACE_MS);
  const stale = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.status, "error"),
        isNotNull(branches.auroraClusterId),
        lte(branches.createdAt, cutoff),
      ),
    );
  for (const b of stale) await enqueue("teardown", b.id);
  return stale.length;
}
