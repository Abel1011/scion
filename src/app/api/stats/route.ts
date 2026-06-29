import { NextResponse } from "next/server";
import { getDemoProject, getStats } from "@/lib/queries";

export async function GET() {
  const project = await getDemoProject();
  if (!project) {
    return NextResponse.json({
      activeBranches: 0,
      lineageUsed: 0,
      lineageTotal: 0,
      costCents: 0,
      goldens: 0,
    });
  }
  return NextResponse.json(await getStats(project.id));
}
