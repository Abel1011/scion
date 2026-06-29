import { NextResponse } from "next/server";
import { getDemoProject, listActivity } from "@/lib/queries";
import { toActivityItemView } from "@/lib/views";

export async function GET() {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ events: [] });
  const rows = await listActivity(project.id);
  return NextResponse.json({ events: rows.map(toActivityItemView) });
}
