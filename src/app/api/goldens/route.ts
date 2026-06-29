import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { clusterIdFromHost, syncPrimaryGolden } from "@/lib/goldens";
import { getDemoProject, listGoldens } from "@/lib/queries";
import { toGoldenView } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ goldens: [] });

  const config = await getConfig();
  // The production connection is the primary golden, derived automatically.
  await syncPrimaryGolden(project.id, config);
  const primaryCid = clusterIdFromHost(config.goldenHost);

  const rows = await listGoldens(project.id);
  const goldensView = rows.map((g) => ({
    ...toGoldenView(g),
    isPrimary: !!primaryCid && g.auroraClusterId === primaryCid,
  }));
  return NextResponse.json({ goldens: goldensView });
}
