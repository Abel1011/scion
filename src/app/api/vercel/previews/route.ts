import { NextResponse } from "next/server";
import { listPreviews } from "@/lib/integrations/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preview deployments of the configured Vercel project (for the wire selector).
export async function GET() {
  const previews = await listPreviews();
  return NextResponse.json({ previews });
}
