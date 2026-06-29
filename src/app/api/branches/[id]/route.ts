import { NextResponse, after } from "next/server";
import { getBranch } from "@/lib/queries";
import { toBranchView } from "@/lib/views";
import { enqueue, processDue } from "@/lib/jobs/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toBranchView(branch));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await enqueue("teardown", id);
  after(async () => {
    await processDue(3);
  });
  return NextResponse.json({ ok: true });
}
