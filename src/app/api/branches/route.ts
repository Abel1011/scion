import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { env } from "@/lib/env";
import { claimGoldenSlot, decrementLineage } from "@/lib/lineage";
import { enqueue, processDue } from "@/lib/jobs/runner";
import { logEvent } from "@/lib/events";
import { getDemoProject, listBranches } from "@/lib/queries";
import { toBranchView } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = ["masked", "schema_only"] as const;
type Mode = (typeof MODES)[number];

export async function GET() {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ branches: [] });
  const rows = await listBranches(project.id);
  return NextResponse.json({ branches: rows.map(toBranchView) });
}

export async function POST(req: Request) {
  const project = await getDemoProject();
  if (!project) {
    return NextResponse.json({ error: "No project configured." }, { status: 400 });
  }

  const active = await listBranches(project.id);
  if (active.length >= env.DEMO_MAX_BRANCHES) {
    return NextResponse.json(
      { error: "Demo at capacity. Prune a branch first." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    gitBranch?: string;
    title?: string;
    dataMode?: string;
    goldenId?: string;
    migrationSql?: string;
    migrationDownSql?: string;
  };

  // Atomically claim a clone slot (increments lineage under the limit).
  const golden = await claimGoldenSlot(project.id, body.goldenId);
  if (!golden) {
    return NextResponse.json(
      { error: "All goldens at lineage capacity." },
      { status: 503 },
    );
  }

  const gitBranch =
    body.gitBranch?.trim() || `branch-${Date.now().toString(36).slice(-5)}`;
  const title = body.title?.trim() || null;
  const dataMode: Mode = MODES.includes(body.dataMode as Mode)
    ? (body.dataMode as Mode)
    : "masked";

  let branch;
  try {
    [branch] = await db
      .insert(branches)
      .values({
        projectId: project.id,
        goldenId: golden.id,
        prNumber: null,
        gitBranch,
        title,
        dataMode,
        status: "provisioning",
        source: "dashboard",
        migrationSql: body.migrationSql?.trim() || null,
        migrationDownSql: body.migrationDownSql?.trim() || null,
      })
      .returning();
  } catch (err) {
    // Don't leak the claimed slot if the insert fails.
    await decrementLineage(golden.id);
    throw err;
  }

  await logEvent(branch.id, "created", { source: "dashboard" });
  await enqueue("provision", branch.id);
  after(async () => {
    await processDue(3);
  });

  return NextResponse.json(toBranchView(branch), { status: 201 });
}
