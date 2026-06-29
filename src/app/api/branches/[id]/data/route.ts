import { NextResponse } from "next/server";
import { getBranch } from "@/lib/queries";
import { getConfig } from "@/lib/config";
import { fetchBranchData } from "@/lib/data-preview";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// In aws mode this reads the real masked clone; otherwise returns sample rows.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  const config = await getConfig();
  const preview = await fetchBranchData({
    projectId: branch?.projectId ?? "",
    host: branch?.connectionHost ?? null,
    config,
  });
  return NextResponse.json(preview);
}
