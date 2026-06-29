import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { env } from "@/lib/env";
import { getBranch } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leaseExpiresAt = new Date(Date.now() + env.DEMO_TTL_MINUTES * 60_000);
  await db
    .update(branches)
    .set({ leaseExpiresAt })
    .where(eq(branches.id, id));
  return NextResponse.json({ leaseExpiresAt: leaseExpiresAt.toISOString() });
}
