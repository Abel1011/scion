import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getDeployRequest } from "@/lib/queries";
import { recomputeDeployRequest } from "@/lib/schema-diff/recompute";
import { toDeployRequestView } from "@/lib/views";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const updated = await recomputeDeployRequest(id);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row, config] = await Promise.all([getDeployRequest(id), getConfig()]);
  const repo = config.githubRepo;
  const view = toDeployRequestView(updated, {
    gitBranch: row?.gitBranch,
    branchTitle: row?.branchTitle,
  });
  return NextResponse.json({
    ...view,
    prUrl:
      repo && view.prNumber
        ? `https://github.com/${repo}/pull/${view.prNumber}`
        : null,
  });
}
