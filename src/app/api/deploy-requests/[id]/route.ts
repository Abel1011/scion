import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deployRequests, type DeployRequest } from "@/db/schema";
import { getConfig } from "@/lib/config";
import { getDeployRequest } from "@/lib/queries";
import { logEvent } from "@/lib/events";
import { runDdlOnGolden } from "@/lib/schema-diff/introspect";
import { recomputeDeployRequest } from "@/lib/schema-diff/recompute";
import { toDeployRequestView } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const row = await getDeployRequest(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const repo = (await getConfig()).githubRepo;
  const view = toDeployRequestView(row.dr, {
    gitBranch: row.gitBranch,
    branchTitle: row.branchTitle,
  });
  return NextResponse.json({
    ...view,
    prUrl:
      repo && view.prNumber
        ? `https://github.com/${repo}/pull/${view.prNumber}`
        : null,
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    confirm?: boolean;
  };
  const row = await getDeployRequest(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let dr = row.dr;
  const config = await getConfig();

  const action =
    body.action === "revert"
      ? "revert"
      : body.action === "reject"
        ? "reject"
        : "apply";

  // Before applying, refresh the diff against the current golden (catches
  // external schema drift) and require confirmation for data-loss changes.
  if (action === "apply") {
    const fresh = await recomputeDeployRequest(id);
    if (fresh) dr = fresh;
    if (dr.hasDestructive && body.confirm !== true) {
      return NextResponse.json(
        {
          error: "This change deletes data. Confirm to proceed.",
          needsConfirm: true,
        },
        { status: 428 },
      );
    }
  }

  // Real DDL against the golden (prod) in aws mode.
  if (config.provisioner === "aws" && config.goldenHost) {
    try {
      if (action === "apply" && dr.migrationSql) {
        await runDdlOnGolden(config, [dr.migrationSql]);
      }
      if (action === "revert" && dr.migrationDownSql) {
        await runDdlOnGolden(config, [dr.migrationDownSql]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Schema change failed on prod: ${message}` },
        { status: 409 },
      );
    }
  }

  const now = new Date();
  const set: Partial<DeployRequest> = {};
  if (action === "revert") {
    set.status = "reverted";
    set.revertedAt = now;
  } else if (action === "reject") {
    set.status = "rejected";
  } else {
    set.status = "applied";
    set.appliedAt = now;
    set.revertedAt = null;
  }

  const [updated] = await db
    .update(deployRequests)
    .set(set)
    .where(eq(deployRequests.id, id))
    .returning();

  const verb =
    action === "revert" ? "reverted" : action === "reject" ? "rejected" : "applied";
  await logEvent(updated.branchId, `deploy_${verb}`, {
    prNumber: updated.prNumber,
  });

  return NextResponse.json(toDeployRequestView(updated));
}
