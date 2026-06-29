import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goldens } from "@/db/schema";
import type { EffectiveConfig } from "@/lib/config";

/** Aurora writer endpoint -> cluster id (the label before ".cluster-"). */
export function clusterIdFromHost(host?: string | null): string | null {
  if (!host) return null;
  const m = host.match(/^([^.]+)\.cluster-/i);
  return m ? m[1] : host.split(".")[0] || null;
}

/**
 * Ensures the project has a primary golden matching the configured production
 * connection. The primary golden is derived automatically from the AWS
 * connection, never entered by hand. No-op when the host is unset or a golden
 * for that cluster already exists.
 */
export async function syncPrimaryGolden(
  projectId: string,
  config: EffectiveConfig,
) {
  const clusterId = clusterIdFromHost(config.goldenHost);
  if (!clusterId) return;
  const existing = await db
    .select({ id: goldens.id })
    .from(goldens)
    .where(
      and(
        eq(goldens.projectId, projectId),
        eq(goldens.auroraClusterId, clusterId),
      ),
    );
  if (existing.length) return;
  await db.insert(goldens).values({
    projectId,
    auroraClusterId: clusterId,
    label: config.goldenDbName ?? "prod",
    lineageDepth: 0,
    status: "active",
  });
}
