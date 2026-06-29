import { NextResponse } from "next/server";
import type { ConnectionConfig } from "@/db/schema";
import { getConfig, saveConnection } from "@/lib/config";

export async function GET() {
  const c = await getConfig();
  return NextResponse.json({
    provisioner: c.provisioner,
    awsRegion: c.awsRegion,
    goldenHost: c.goldenHost ?? null,
    goldenDbName: c.goldenDbName,
    goldenMasterUser: c.goldenMasterUser ?? null,
    dbSubnetGroupName: c.dbSubnetGroupName ?? null,
    dbSecurityGroupId: c.dbSecurityGroupId ?? null,
    vercelTeamId: c.vercelTeamId ?? null,
    vercelProjectId: c.vercelProjectId ?? null,
    vercelEnvKey: c.vercelEnvKey,
    githubRepo: c.githubRepo ?? null,
    autoProvision: c.autoProvision,
    set: {
      awsAccessKeyId: !!c.awsAccessKeyId,
      awsSecretAccessKey: !!c.awsSecretAccessKey,
      goldenMasterPassword: !!c.goldenMasterPassword,
      vercelToken: !!c.vercelToken,
      githubToken: !!c.githubToken,
      githubWebhookSecret: !!c.githubWebhookSecret,
    },
  });
}

const NON_SECRET: (keyof ConnectionConfig)[] = [
  "awsRegion",
  "goldenHost",
  "goldenDbName",
  "goldenMasterUser",
  "dbSubnetGroupName",
  "dbSecurityGroupId",
  "vercelTeamId",
  "vercelProjectId",
  "vercelEnvKey",
  "githubRepo",
];

const SECRET: (keyof ConnectionConfig)[] = [
  "awsAccessKeyId",
  "awsSecretAccessKey",
  "goldenMasterPassword",
  "vercelToken",
  "githubToken",
  "githubWebhookSecret",
];

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provisioner = body.provisioner === "aws" ? "aws" : "mock";

  const patch: Partial<ConnectionConfig> = {};
  const p = patch as Record<string, unknown>;
  for (const k of NON_SECRET) {
    if (typeof body[k] === "string") p[k] = (body[k] as string).trim();
  }
  // Secrets only overwrite when a non-empty value is provided.
  for (const k of SECRET) {
    const v = body[k];
    if (typeof v === "string" && v.length > 0) p[k] = v;
  }
  if (typeof body.autoProvision === "boolean") {
    patch.autoProvision = body.autoProvision;
  }

  await saveConnection(provisioner, patch);
  return NextResponse.json({ ok: true });
}
