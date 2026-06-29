import type {
  ActivityItemView,
  BranchView,
  ConnectionView,
  DeployRequestView,
  EventView,
  GoldenView,
  MaskingRuleView,
  ProjectInfo,
} from "@/lib/views";

export type ConnectionInput = {
  provisioner: string;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  goldenHost?: string;
  goldenDbName?: string;
  goldenMasterUser?: string;
  goldenMasterPassword?: string;
  dbSubnetGroupName?: string;
  dbSecurityGroupId?: string;
  vercelTeamId?: string;
  vercelToken?: string;
  vercelProjectId?: string;
  vercelEnvKey?: string;
  githubRepo?: string;
  githubToken?: string;
  githubWebhookSecret?: string;
  autoProvision?: boolean;
};

export type Stats = {
  activeBranches: number;
  lineageUsed: number;
  lineageTotal: number;
  costCents: number;
  goldens: number;
};

export type MaskedData = {
  table: string;
  columns: string[];
  rows: Record<string, string>[];
};

export type PreviewDeployment = {
  uid: string;
  gitBranch: string;
  prNumber: number | null;
  url: string | null;
  state: string | null;
  createdAt: number | null;
};

export type VercelProjectItem = {
  id: string;
  name: string;
  framework: string | null;
  repo: string | null;
  repoType: string | null;
  db: {
    detected: boolean;
    isAurora: boolean;
    isGolden: boolean;
    kind: string | null;
  };
};

export type BranchDetail = {
  branch: BranchView;
  events: EventView[];
  deployRequest: DeployRequestView | null;
  data: MaskedData | null;
};

export type CreateBranchInput = {
  gitBranch?: string;
  title?: string;
  dataMode?: string;
  goldenId?: string;
  migrationSql?: string;
  migrationDownSql?: string;
};

export type NewMaskingRule = {
  tableName: string;
  columnName: string;
  fn: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  stats: () => request<Stats>("/api/stats"),
  activity: () => request<{ events: ActivityItemView[] }>("/api/activity"),
  branches: () => request<{ branches: BranchView[] }>("/api/branches"),
  goldens: () => request<{ goldens: GoldenView[] }>("/api/goldens"),
  deployRequests: () =>
    request<{ deployRequests: DeployRequestView[] }>("/api/deploy-requests"),
  deployRequestDetail: (id: string) =>
    request<DeployRequestView>(`/api/deploy-requests/${id}`),
  maskedData: (id: string) => request<MaskedData>(`/api/branches/${id}/data`),
  branchDetail: (id: string) =>
    request<BranchDetail>(`/api/branches/${id}/detail`),
  createBranch: (input?: CreateBranchInput) =>
    request<BranchView>("/api/branches", json(input ?? {})),
  teardown: (id: string) =>
    request<{ ok: boolean }>(`/api/branches/${id}`, { method: "DELETE" }),
  resetBranch: (id: string) =>
    request<{ ok: boolean }>(`/api/branches/${id}/reset`, { method: "POST" }),
  pauseBranch: (id: string) =>
    request<{ status: string }>(`/api/branches/${id}/pause`, { method: "POST" }),
  renewBranch: (id: string) =>
    request<{ leaseExpiresAt: string }>(`/api/branches/${id}/renew`, {
      method: "POST",
    }),
  deployAction: (
    id: string,
    action: "apply" | "revert" | "reject",
    confirm = false,
  ) =>
    request<DeployRequestView>(
      `/api/deploy-requests/${id}`,
      json({ action, confirm }),
    ),
  recomputeDeploy: (id: string) =>
    request<DeployRequestView>(`/api/deploy-requests/${id}/recompute`, {
      method: "POST",
    }),
  updateProject: (patch: Partial<ProjectInfo>) =>
    request<{ ok: boolean }>("/api/project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  vercelProjects: () =>
    request<{ projects: VercelProjectItem[] }>("/api/vercel/projects"),
  vercelPreviews: () =>
    request<{ previews: PreviewDeployment[] }>("/api/vercel/previews"),
  vercelEnvKeys: () => request<{ keys: string[] }>("/api/vercel/env-keys"),
  githubRepos: () =>
    request<{ repos: { fullName: string; private: boolean; fork: boolean }[] }>(
      "/api/github/repos",
    ),
  wireBranch: (id: string, gitBranch?: string) =>
    request<{ ok: boolean; gitBranch: string }>(
      `/api/branches/${id}/wire`,
      json({ gitBranch }),
    ),
  connections: () => request<ConnectionView>("/api/connections"),
  updateConnections: (body: ConnectionInput) =>
    request<{ ok: boolean }>("/api/connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  project: () =>
    request<{ project: ProjectInfo | null; goldens: GoldenView[] }>(
      "/api/project",
    ),
  schema: () =>
    request<{ tables: { name: string; columns: string[] }[] }>("/api/schema"),
  maskingRules: () =>
    request<{ rules: MaskingRuleView[] }>("/api/masking-rules"),
  addMaskingRule: (rule: NewMaskingRule) =>
    request<MaskingRuleView>("/api/masking-rules", json(rule)),
  deleteMaskingRule: (id: string) =>
    request<{ ok: boolean }>(`/api/masking-rules/${id}`, { method: "DELETE" }),
};
