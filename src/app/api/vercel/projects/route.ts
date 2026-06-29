import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VercelProject = {
  id: string;
  name: string;
  framework?: string | null;
  link?: { type?: string; org?: string; repo?: string };
};

type VercelEnv = {
  id?: string;
  key: string;
  value?: string;
  target?: string[] | string;
};

// Env var names commonly holding a Postgres connection string.
const DB_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
];

function hostFromConn(value: string): string | null {
  try {
    return new URL(value).hostname || null;
  } catch {
    return null;
  }
}

// Friendly provider label derived from the host. The raw host (which exposes
// infrastructure endpoints) is never returned to the client.
function providerLabel(host: string): string {
  const h = host.toLowerCase();
  if (h.includes("mongodb")) return "MongoDB";
  if (h.includes("neon.tech")) return "Neon";
  if (h.includes("supabase")) return "Supabase";
  if (h.includes("rds.amazonaws.com")) return "Amazon RDS";
  if (h.includes("postgres") || h.includes("pooler")) return "PostgreSQL";
  return "External DB";
}

function classify(host: string | null, goldenHost?: string) {
  if (!host) return { detected: false, isAurora: false, isGolden: false, kind: null };
  const isAurora = /\.rds\.amazonaws\.com$/i.test(host);
  const isGolden = !!goldenHost && host === goldenHost;
  const kind = isGolden
    ? "Golden cluster"
    : isAurora
      ? "Amazon Aurora"
      : providerLabel(host);
  return { detected: true, isAurora, isGolden, kind };
}

function withTeam(url: URL, teamId?: string) {
  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

export async function GET() {
  const config = await getConfig();
  if (!config.vercelToken) {
    return NextResponse.json(
      { error: "Vercel token not configured." },
      { status: 400 },
    );
  }
  const headers = { Authorization: `Bearer ${config.vercelToken}` };

  const projUrl = withTeam(
    new URL("https://api.vercel.com/v9/projects"),
    config.vercelTeamId,
  );
  projUrl.searchParams.set("limit", "100");
  const projRes = await fetch(projUrl, { headers });
  if (!projRes.ok) {
    return NextResponse.json(
      { error: `Vercel API ${projRes.status}` },
      { status: 502 },
    );
  }
  const { projects } = (await projRes.json()) as { projects: VercelProject[] };

  // For each project, read its env to detect a Postgres/Aurora connection.
  const out = await Promise.all(
    projects.map(async (p) => {
      let db = classify(null, config.goldenHost);
      try {
        const envUrl = withTeam(
          new URL(`https://api.vercel.com/v9/projects/${p.id}/env`),
          config.vercelTeamId,
        );
        const envRes = await fetch(envUrl, { headers });
        if (envRes.ok) {
          const { envs } = (await envRes.json()) as { envs: VercelEnv[] };
          // Prefer a production-targeted var when the key repeats per target.
          const isProd = (e: VercelEnv) =>
            Array.isArray(e.target)
              ? e.target.includes("production")
              : e.target === "production";
          let hit: VercelEnv | undefined;
          for (const key of DB_KEYS) {
            const matches = envs.filter((e) => e.key === key);
            hit = matches.find(isProd) ?? matches[0];
            if (hit) break;
          }
          if (hit) {
            // A DB var exists. The list returns ciphertext, so fetch the single
            // env to get the decrypted value and classify its host.
            db = { detected: true, isAurora: false, isGolden: false, kind: "Database" };
            let value = hit.value;
            if ((!value || !value.startsWith("postgres")) && hit.id) {
              const oneRes = await fetch(
                withTeam(
                  new URL(`https://api.vercel.com/v9/projects/${p.id}/env/${hit.id}`),
                  config.vercelTeamId,
                ),
                { headers },
              );
              if (oneRes.ok) {
                const one = (await oneRes.json()) as VercelEnv;
                value = one.value ?? value;
              }
            }
            const host = value ? hostFromConn(value) : null;
            if (host) db = classify(host, config.goldenHost);
          }
        }
      } catch {
        /* ignore per-project errors */
      }
      return {
        id: p.id,
        name: p.name,
        framework: p.framework ?? null,
        repo: p.link?.repo ? `${p.link.org}/${p.link.repo}` : null,
        repoType: p.link?.type ?? null,
        db,
      };
    }),
  );

  return NextResponse.json({ projects: out });
}
