import { getConfig } from "@/lib/config";

type Deployment = {
  uid: string;
  name?: string;
  url?: string;
  state?: string;
  readyState?: string;
  created?: number;
  meta?: { githubCommitRef?: string; githubPrId?: string };
};

export type PreviewDeployment = {
  uid: string;
  gitBranch: string;
  prNumber: number | null;
  url: string | null;
  state: string | null;
  createdAt: number | null;
};

/** Lists the configured project's preview deployments (latest per git branch). */
export async function listPreviews(): Promise<PreviewDeployment[]> {
  const config = await getConfig();
  if (!config.vercelToken || !config.vercelProjectId) return [];
  const team = config.vercelTeamId ? `&teamId=${config.vercelTeamId}` : "";
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${config.vercelProjectId}&target=preview&limit=30${team}`,
    { headers: { Authorization: `Bearer ${config.vercelToken}` } },
  );
  if (!res.ok) return [];
  const { deployments } = (await res.json()) as { deployments?: Deployment[] };
  const seen = new Set<string>();
  const out: PreviewDeployment[] = [];
  for (const d of deployments ?? []) {
    const gb = d.meta?.githubCommitRef;
    if (!gb || seen.has(gb)) continue;
    seen.add(gb);
    out.push({
      uid: d.uid,
      gitBranch: gb,
      prNumber: d.meta?.githubPrId ? Number(d.meta.githubPrId) : null,
      url: d.url ?? null,
      state: d.state ?? d.readyState ?? null,
      createdAt: d.created ?? null,
    });
  }
  return out;
}

/**
 * Wires a branch's database into the configured Vercel project's preview:
 * 1. injects a git-branch-scoped DATABASE_URL (preview target), then
 * 2. redeploys that branch's latest preview so it actually picks up the value.
 * No-op (returns false) when Vercel isn't configured.
 */
export async function wirePreview(
  gitBranch: string,
  databaseUrl: string,
): Promise<boolean> {
  const config = await getConfig();
  if (!config.vercelToken || !config.vercelProjectId) return false;

  const auth = { Authorization: `Bearer ${config.vercelToken}` };
  const headers = { ...auth, "Content-Type": "application/json" };
  const team = config.vercelTeamId ? `&teamId=${config.vercelTeamId}` : "";

  // 1. Inject the branch-scoped preview env var.
  const envRes = await fetch(
    `https://api.vercel.com/v10/projects/${config.vercelProjectId}/env?upsert=true${team}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        key: config.vercelEnvKey,
        value: databaseUrl,
        type: "encrypted",
        target: ["preview"],
        gitBranch,
      }),
    },
  );
  if (!envRes.ok) return false;

  // 2. Find the latest preview deployment for this git branch.
  const depRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${config.vercelProjectId}&target=preview&limit=30${team}`,
    { headers: auth },
  );
  if (!depRes.ok) return true; // env set; couldn't look up deployments
  const { deployments } = (await depRes.json()) as { deployments?: Deployment[] };
  const match = (deployments ?? []).find(
    (d) => d.meta?.githubCommitRef === gitBranch,
  );
  if (!match) return true; // env set; no preview yet, next build picks it up

  // 3. Redeploy that preview so it rebuilds with the injected value.
  await fetch(`https://api.vercel.com/v13/deployments?forceNew=1${team}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      deploymentId: match.uid,
      name: match.name ?? config.vercelProjectId,
      target: "preview",
    }),
  }).catch(() => undefined);

  return true;
}
