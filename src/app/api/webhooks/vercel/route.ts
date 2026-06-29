import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Acknowledges Vercel deployment events. Branch creation is driven by GitHub
// PR webhooks; this endpoint exists for deployment-id correlation.
export async function POST(req: Request) {
  await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true });
}
