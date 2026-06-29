import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { goldens } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Atomically claims a clone slot on an active golden under the copy-on-write
 * lineage limit, incrementing its depth in the same conditional UPDATE so two
 * concurrent creates can never push a golden past the limit. Returns the
 * claimed golden, or null when none have free capacity (caller returns 503).
 *
 * When `preferredId` is set, only that golden is tried; otherwise the golden
 * with the most free capacity is preferred.
 */
export async function claimGoldenSlot(projectId: string, preferredId?: string) {
  const limit = env.LINEAGE_LIMIT;

  if (preferredId) {
    const [g] = await db
      .update(goldens)
      .set({ lineageDepth: sql`${goldens.lineageDepth} + 1` })
      .where(
        and(
          eq(goldens.id, preferredId),
          eq(goldens.status, "active"),
          lt(goldens.lineageDepth, limit),
        ),
      )
      .returning();
    return g ?? null;
  }

  const candidates = await db
    .select()
    .from(goldens)
    .where(and(eq(goldens.projectId, projectId), eq(goldens.status, "active")))
    .orderBy(goldens.lineageDepth);

  for (const c of candidates) {
    if (c.lineageDepth >= limit) continue;
    const [g] = await db
      .update(goldens)
      .set({ lineageDepth: sql`${goldens.lineageDepth} + 1` })
      .where(and(eq(goldens.id, c.id), lt(goldens.lineageDepth, limit)))
      .returning();
    if (g) return g;
  }
  return null;
}

export async function decrementLineage(goldenId: string) {
  await db
    .update(goldens)
    .set({ lineageDepth: sql`greatest(${goldens.lineageDepth} - 1, 0)` })
    .where(eq(goldens.id, goldenId));
}
