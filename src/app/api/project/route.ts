import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getDemoProject, listGoldens } from "@/lib/queries";
import { toGoldenView } from "@/lib/views";

export async function GET() {
  const project = await getDemoProject();
  if (!project) {
    return NextResponse.json({ project: null, goldens: [] });
  }
  const goldens = await listGoldens(project.id);
  return NextResponse.json({
    project: {
      name: project.name,
      githubRepo: project.githubRepo,
      vercelProjectId: project.vercelProjectId,
    },
    goldens: goldens.map(toGoldenView),
  });
}

export async function PATCH(req: Request) {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    githubRepo?: string;
    vercelProjectId?: string;
  };
  const set: Partial<typeof projects.$inferInsert> = {};
  if (typeof body.name === "string") set.name = body.name.trim() || project.name;
  if (typeof body.githubRepo === "string")
    set.githubRepo = body.githubRepo.trim() || null;
  if (typeof body.vercelProjectId === "string")
    set.vercelProjectId = body.vercelProjectId.trim() || null;

  if (Object.keys(set).length) {
    await db.update(projects).set(set).where(eq(projects.id, project.id));
  }
  return NextResponse.json({ ok: true });
}
