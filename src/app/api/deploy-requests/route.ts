import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getDemoProject, listDeployRequests } from "@/lib/queries";
import { toDeployRequestView } from "@/lib/views";

export async function GET() {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ deployRequests: [] });
  const repo = (await getConfig()).githubRepo;
  const rows = await listDeployRequests(project.id);
  return NextResponse.json({
    deployRequests: rows.map((r) => {
      const view = toDeployRequestView(r.dr, {
        gitBranch: r.gitBranch,
        branchTitle: r.branchTitle,
      });
      return {
        ...view,
        prUrl:
          repo && view.prNumber
            ? `https://github.com/${repo}/pull/${view.prNumber}`
            : null,
      };
    }),
  });
}
