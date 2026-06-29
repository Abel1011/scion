import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { getBranch } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Toggles a branch between ready (active) and paused (scaled to zero).
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (branch.status === "ready") {
    await db
      .update(branches)
      .set({ status: "paused", costCents: 0, statusDetail: "scaled to zero" })
      .where(eq(branches.id, id));
    return NextResponse.json({ status: "paused" });
  }
  if (branch.status === "paused") {
    await db
      .update(branches)
      .set({ status: "ready", costCents: 2, statusDetail: null })
      .where(eq(branches.id, id));
    return NextResponse.json({ status: "ready" });
  }
  return NextResponse.json(
    { error: "Branch must be ready or paused." },
    { status: 400 },
  );
}
