import { NextResponse } from "next/server";
import {
  getBranch,
  getBranchEvents,
  getDeployRequestForBranch,
} from "@/lib/queries";
import { getConfig } from "@/lib/config";
import { fetchBranchData } from "@/lib/data-preview";
import { toBranchView, toDeployRequestView, toEventView } from "@/lib/views";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [events, dr, config] = await Promise.all([
    getBranchEvents(id),
    getDeployRequestForBranch(id),
    getConfig(),
  ]);

  const data =
    branch.status === "ready"
      ? await fetchBranchData({
          projectId: branch.projectId,
          host: branch.connectionHost,
          config,
        })
      : null;

  return NextResponse.json({
    branch: toBranchView(branch),
    events: events.map(toEventView),
    deployRequest: dr ? toDeployRequestView(dr) : null,
    data,
  });
}
