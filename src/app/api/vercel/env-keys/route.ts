import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Env var names already defined on the configured Vercel project, so the user
// can pick which one Scion injects the branch database URL into.
export async function GET() {
  const config = await getConfig();
  if (!config.vercelToken || !config.vercelProjectId) {
    return NextResponse.json({ keys: [] });
  }

  const url = new URL(
    `https://api.vercel.com/v9/projects/${config.vercelProjectId}/env`,
  );
  if (config.vercelTeamId) url.searchParams.set("teamId", config.vercelTeamId);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.vercelToken}` },
  });
  if (!res.ok) return NextResponse.json({ keys: [] });

  const { envs } = (await res.json()) as { envs?: { key: string }[] };
  const keys = [...new Set((envs ?? []).map((e) => e.key))].sort();
  return NextResponse.json({ keys });
}
