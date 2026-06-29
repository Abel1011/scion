import { NextResponse } from "next/server";
import { getBranch } from "@/lib/queries";
import { getConfig, branchDatabaseUrl } from "@/lib/config";
import { listPreviews, wirePreview } from "@/lib/integrations/vercel";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Manually wire this branch's DATABASE_URL into a Vercel preview. With no
// gitBranch in the body it targets the latest preview ("send to last").
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { gitBranch?: string };

  const branch = await getBranch(id);
  if (!branch?.connectionHost) {
    return NextResponse.json(
      { error: "Branch has no connection yet." },
      { status: 409 },
    );
  }

  const config = await getConfig();
  if (!config.vercelToken || !config.vercelProjectId) {
    return NextResponse.json(
      { error: "Configure a Vercel project in Settings first." },
      { status: 400 },
    );
  }

  let target = body.gitBranch?.trim();
  if (!target) {
    const previews = await listPreviews();
    target = previews[0]?.gitBranch;
  }
  if (!target) {
    return NextResponse.json(
      { error: "No preview deployments found on the Vercel project." },
      { status: 409 },
    );
  }

  const ok = await wirePreview(target, branchDatabaseUrl(branch.connectionHost, config));
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to wire the preview." },
      { status: 502 },
    );
  }

  await logEvent(id, "preview_wired", { gitBranch: target });
  return NextResponse.json({ ok: true, gitBranch: target });
}
