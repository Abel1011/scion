import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  branches,
  deployRequests,
  events,
  goldens,
  maskingPolicies,
  maskingRules,
  projects,
} from "@/db/schema";

export async function getDemoProject() {
  const [project] = await db.select().from(projects).limit(1);
  return project;
}

export async function listBranches(projectId: string) {
  return db
    .select()
    .from(branches)
    .where(and(eq(branches.projectId, projectId), ne(branches.status, "deleted")))
    .orderBy(desc(branches.createdAt));
}

export async function getBranch(id: string) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, id));
  return branch;
}

export async function listGoldens(projectId: string) {
  return db
    .select()
    .from(goldens)
    .where(eq(goldens.projectId, projectId))
    .orderBy(goldens.label);
}

export async function latestDeployRequest(projectId: string) {
  const rows = await db
    .select({ dr: deployRequests })
    .from(deployRequests)
    .innerJoin(branches, eq(deployRequests.branchId, branches.id))
    .where(eq(branches.projectId, projectId))
    .orderBy(desc(deployRequests.createdAt))
    .limit(1);
  return rows[0]?.dr;
}

export async function listActivity(projectId: string, limit = 100) {
  return db
    .select({
      id: events.id,
      type: events.type,
      ts: events.ts,
      payload: events.payload,
      branchId: events.branchId,
      gitBranch: branches.gitBranch,
      branchTitle: branches.title,
      prNumber: branches.prNumber,
    })
    .from(events)
    .leftJoin(branches, eq(events.branchId, branches.id))
    .where(or(eq(branches.projectId, projectId), isNull(events.branchId)))
    .orderBy(desc(events.ts))
    .limit(limit);
}

export async function getBranchEvents(branchId: string) {
  return db
    .select()
    .from(events)
    .where(eq(events.branchId, branchId))
    .orderBy(asc(events.ts));
}

export async function listDeployRequests(projectId: string) {
  return db
    .select({
      dr: deployRequests,
      gitBranch: branches.gitBranch,
      branchTitle: branches.title,
    })
    .from(deployRequests)
    .innerJoin(branches, eq(deployRequests.branchId, branches.id))
    .where(eq(branches.projectId, projectId))
    .orderBy(desc(deployRequests.createdAt));
}

export async function getDeployRequest(id: string) {
  const [row] = await db
    .select({
      dr: deployRequests,
      gitBranch: branches.gitBranch,
      branchTitle: branches.title,
    })
    .from(deployRequests)
    .innerJoin(branches, eq(deployRequests.branchId, branches.id))
    .where(eq(deployRequests.id, id))
    .limit(1);
  return row;
}

export async function getDeployRequestForBranch(branchId: string) {
  const [d] = await db
    .select()
    .from(deployRequests)
    .where(eq(deployRequests.branchId, branchId))
    .orderBy(desc(deployRequests.createdAt))
    .limit(1);
  return d;
}

export async function listMaskingRules(projectId: string) {
  return db
    .select({
      id: maskingRules.id,
      tableName: maskingRules.tableName,
      columnName: maskingRules.columnName,
      fn: maskingRules.fn,
      deterministic: maskingRules.deterministic,
    })
    .from(maskingRules)
    .innerJoin(maskingPolicies, eq(maskingRules.policyId, maskingPolicies.id))
    .where(eq(maskingPolicies.projectId, projectId))
    .orderBy(asc(maskingRules.tableName), asc(maskingRules.columnName));
}

export async function getOrCreatePolicyId(projectId: string) {
  const [existing] = await db
    .select()
    .from(maskingPolicies)
    .where(eq(maskingPolicies.projectId, projectId))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(maskingPolicies)
    .values({ projectId, name: "default" })
    .returning();
  return created.id;
}

export async function getStats(projectId: string) {
  const all = await listBranches(projectId);
  const golds = await listGoldens(projectId);
  const active = all.filter((b) => b.status !== "deleted");
  const costCents = active.reduce((sum, b) => sum + b.costCents, 0);
  const lineageUsed = golds.reduce((sum, g) => sum + g.lineageDepth, 0);
  const lineageTotal = golds.length * 15;
  return {
    activeBranches: active.length,
    lineageUsed,
    lineageTotal,
    costCents,
    goldens: golds.length,
  };
}
