import { getConfig } from "@/lib/config";

/** Posts a comment on the PR (branch status / schema diff). No-op when unset. */
export async function postPrComment(
  repo: string | null,
  prNumber: number | null,
  body: string,
): Promise<boolean> {
  const config = await getConfig();
  if (!config.githubToken || !repo || !prNumber) return false;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    },
  );

  return res.ok;
}
