import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections, type ConnectionConfig } from "@/db/schema";
import { env } from "@/lib/env";

export type Provisioner = "mock" | "aws";

export type EffectiveConfig = {
  provisioner: Provisioner;
  awsRegion: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  goldenHost?: string;
  goldenDbName: string;
  goldenMasterUser?: string;
  goldenMasterPassword?: string;
  dbSubnetGroupName?: string;
  dbSecurityGroupId?: string;
  vercelToken?: string;
  vercelTeamId?: string;
  vercelProjectId?: string;
  vercelEnvKey: string;
  githubRepo?: string;
  githubToken?: string;
  githubWebhookSecret?: string;
  autoProvision: boolean;
};

const take = (a?: string, b?: string) => (a && a.length ? a : b);

/** Real connection string for a branch's clone (golden creds + clone host). */
export function branchDatabaseUrl(host: string, config: EffectiveConfig): string {
  const user = config.goldenMasterUser ?? "scion";
  const pass = encodeURIComponent(config.goldenMasterPassword ?? "");
  return `postgres://${user}:${pass}@${host}:5432/${config.goldenDbName}?sslmode=require`;
}

async function getRow() {
  const [row] = await db.select().from(connections).limit(1);
  return row;
}

/** Effective config: values saved in the DB take precedence over env defaults. */
export async function getConfig(): Promise<EffectiveConfig> {
  const row = await getRow().catch(() => undefined);
  const c: ConnectionConfig = row?.config ?? {};
  return {
    provisioner: (row?.provisioner as Provisioner) ?? env.PROVISIONER,
    awsRegion: take(c.awsRegion, env.AWS_REGION) ?? "us-east-1",
    awsAccessKeyId: take(c.awsAccessKeyId, env.AWS_ACCESS_KEY_ID),
    awsSecretAccessKey: take(c.awsSecretAccessKey, env.AWS_SECRET_ACCESS_KEY),
    goldenHost: take(c.goldenHost, env.GOLDEN_HOST),
    goldenDbName: take(c.goldenDbName, env.GOLDEN_DB_NAME) ?? "shop",
    goldenMasterUser: take(c.goldenMasterUser, env.GOLDEN_MASTER_USER),
    goldenMasterPassword: take(c.goldenMasterPassword, env.GOLDEN_MASTER_PASSWORD),
    dbSubnetGroupName: take(c.dbSubnetGroupName, env.DB_SUBNET_GROUP_NAME),
    dbSecurityGroupId: take(c.dbSecurityGroupId, env.DB_SECURITY_GROUP_ID),
    vercelToken: take(c.vercelToken, env.VERCEL_TOKEN),
    vercelTeamId: take(c.vercelTeamId, env.VERCEL_TEAM_ID),
    vercelProjectId: take(c.vercelProjectId, env.VERCEL_PROJECT_ID),
    vercelEnvKey: c.vercelEnvKey || "DATABASE_URL",
    githubRepo: take(c.githubRepo, env.GITHUB_REPO),
    githubToken: take(c.githubToken, env.GITHUB_TOKEN),
    githubWebhookSecret: take(c.githubWebhookSecret, env.GITHUB_WEBHOOK_SECRET),
    autoProvision: c.autoProvision ?? false,
  };
}

export async function getConnectionRow() {
  return getRow();
}

export async function saveConnection(
  provisioner: Provisioner,
  patch: Partial<ConnectionConfig>,
) {
  const row = await getRow();
  const merged: ConnectionConfig = { ...(row?.config ?? {}), ...patch };
  if (row) {
    await db
      .update(connections)
      .set({ provisioner, config: merged, updatedAt: new Date() })
      .where(eq(connections.id, row.id));
  } else {
    await db.insert(connections).values({ provisioner, config: merged });
  }
}
