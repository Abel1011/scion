import type {
  Branch,
  DeployRequest,
  EventRow,
  Golden,
  LintFinding,
} from "@/db/schema";

export type BranchView = {
  id: string;
  prNumber: number | null;
  gitBranch: string;
  title: string | null;
  dataMode: string;
  status: string;
  statusDetail: string | null;
  costCents: number;
  leaseExpiresAt: string | null;
  connectionHost: string | null;
  source: string;
  createdAt: string;
};

export type GoldenView = {
  id: string;
  label: string;
  clusterId: string;
  lineageDepth: number;
  status: string;
  isPrimary?: boolean;
};

export type DeployRequestView = {
  id: string;
  prNumber: number | null;
  baseRef: string;
  headRef: string;
  diffSql: string;
  hasDestructive: boolean;
  lint: LintFinding[];
  status: string;
  createdAt: string;
  appliedAt: string | null;
  revertedAt: string | null;
  gitBranch?: string | null;
  branchTitle?: string | null;
  prUrl?: string | null;
};

export type EventView = {
  id: string;
  type: string;
  ts: string;
  payload: Record<string, unknown> | null;
};

export type MaskingRuleView = {
  id: string;
  tableName: string;
  columnName: string;
  fn: string;
  deterministic: boolean;
};

export type ProjectInfo = {
  name: string;
  githubRepo: string | null;
  vercelProjectId: string | null;
};

export type ConnectionView = {
  provisioner: "mock" | "aws";
  awsRegion: string;
  goldenHost: string | null;
  goldenDbName: string;
  goldenMasterUser: string | null;
  dbSubnetGroupName: string | null;
  dbSecurityGroupId: string | null;
  vercelTeamId: string | null;
  vercelProjectId: string | null;
  vercelEnvKey: string;
  githubRepo: string | null;
  autoProvision: boolean;
  set: {
    awsAccessKeyId: boolean;
    awsSecretAccessKey: boolean;
    goldenMasterPassword: boolean;
    vercelToken: boolean;
    githubToken: boolean;
    githubWebhookSecret: boolean;
  };
};

export type ActivityItemView = {
  id: string;
  type: string;
  ts: string;
  branchId: string | null;
  gitBranch: string | null;
  branchTitle: string | null;
  prNumber: number | null;
  detail: string | null;
};

export function toActivityItemView(row: {
  id: string;
  type: string;
  ts: Date;
  payload: Record<string, unknown> | null;
  branchId: string | null;
  gitBranch: string | null;
  branchTitle: string | null;
  prNumber: number | null;
}): ActivityItemView {
  const p = row.payload ?? {};
  let detail: string | null = null;
  if (row.type.startsWith("masking_rule")) {
    detail = `${String(p.table ?? "?")}.${String(p.column ?? "?")}`;
  } else if (row.type === "golden_added") {
    detail = String(p.label ?? "");
  }
  return {
    id: row.id,
    type: row.type,
    ts: row.ts.toISOString(),
    branchId: row.branchId,
    gitBranch: row.gitBranch,
    branchTitle: row.branchTitle,
    prNumber: row.prNumber,
    detail,
  };
}

export function toBranchView(b: Branch): BranchView {
  return {
    id: b.id,
    prNumber: b.prNumber,
    gitBranch: b.gitBranch,
    title: b.title,
    dataMode: b.dataMode,
    status: b.status,
    statusDetail: b.statusDetail,
    costCents: b.costCents,
    leaseExpiresAt: b.leaseExpiresAt?.toISOString() ?? null,
    connectionHost: b.connectionHost,
    source: b.source,
    createdAt: b.createdAt.toISOString(),
  };
}

export function toGoldenView(g: Golden): GoldenView {
  return {
    id: g.id,
    label: g.label,
    clusterId: g.auroraClusterId,
    lineageDepth: g.lineageDepth,
    status: g.status,
  };
}

export function toEventView(e: EventRow): EventView {
  return {
    id: e.id,
    type: e.type,
    ts: e.ts.toISOString(),
    payload: e.payload ?? null,
  };
}

export function toDeployRequestView(
  d: DeployRequest,
  branch?: { gitBranch?: string | null; branchTitle?: string | null },
): DeployRequestView {
  return {
    id: d.id,
    prNumber: d.prNumber,
    baseRef: d.baseRef,
    headRef: d.headRef,
    diffSql: d.diffSql,
    hasDestructive: d.hasDestructive,
    lint: d.lintFindings,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    appliedAt: d.appliedAt?.toISOString() ?? null,
    revertedAt: d.revertedAt?.toISOString() ?? null,
    gitBranch: branch?.gitBranch ?? null,
    branchTitle: branch?.branchTitle ?? null,
  };
}
