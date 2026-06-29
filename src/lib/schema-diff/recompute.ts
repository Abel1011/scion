import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, deployRequests, type DeployRequest } from "@/db/schema";
import { getConfig } from "@/lib/config";
import { diffGoldenVsClone } from "./introspect";

/**
 * Re-introspects the clone vs the golden and refreshes the deploy request's
 * diff / destructive flag / lint. Catches schema changes made since creation
 * (e.g. someone altered prod externally). No-op in mock mode or if the clone
 * is gone (returns the stored row).
 */
export async function recomputeDeployRequest(
  id: string,
): Promise<DeployRequest | undefined> {
  const [dr] = await db
    .select()
    .from(deployRequests)
    .where(eq(deployRequests.id, id));
  if (!dr) return undefined;

  const config = await getConfig();
  if (config.provisioner !== "aws" || !config.goldenHost || !dr.branchId) {
    return dr;
  }

  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, dr.branchId));
  if (!branch?.connectionHost) return dr; // clone pruned, keep stored snapshot

  try {
    const diff = await diffGoldenVsClone(
      config.goldenHost,
      branch.connectionHost,
      config,
    );
    const [updated] = await db
      .update(deployRequests)
      .set({
        diffSql: diff.diffSql,
        hasDestructive: diff.hasDestructive,
        lintFindings: diff.lint,
      })
      .where(eq(deployRequests.id, id))
      .returning();
    return updated;
  } catch {
    return dr;
  }
}
