import { NextResponse, after } from "next/server";
import { getBranch } from "@/lib/queries";
import { processDue, runReset } from "@/lib/jobs/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  after(async () => {
    await runReset(id);
    await processDue(3);
  });
  return NextResponse.json({ ok: true });
}
