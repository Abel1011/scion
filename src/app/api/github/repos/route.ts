import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GitHubRepo = {
  full_name: string;
  private: boolean;
  fork: boolean;
  updated_at: string;
};

export async function GET() {
  const config = await getConfig();
  if (!config.githubToken) {
    return NextResponse.json(
      { error: "GitHub token not configured." },
      { status: 400 },
    );
  }
  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `GitHub API ${res.status}` },
      { status: 502 },
    );
  }
  const repos = (await res.json()) as GitHubRepo[];
  const out = repos.map((r) => ({
    fullName: r.full_name,
    private: r.private,
    fork: r.fork,
  }));
  return NextResponse.json({ repos: out });
}
