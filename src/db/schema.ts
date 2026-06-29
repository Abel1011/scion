import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const branchStatus = pgEnum("branch_status", [
  "provisioning",
  "migrating",
  "masking",
  "ready",
  "paused",
  "tearing_down",
  "deleted",
  "error",
]);

export const dataMode = pgEnum("data_mode", [
  "masked",
  "schema_only",
  "synthetic",
]);

export const goldenStatus = pgEnum("golden_status", [
  "active",
  "rotating",
  "retired",
]);

export const deployStatus = pgEnum("deploy_status", [
  "open",
  "approved",
  "applied",
  "reverted",
  "rejected",
]);

export const jobKind = pgEnum("job_kind", [
  "provision",
  "teardown",
  "apply_migration",
]);

export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vercelProjectId: text("vercel_project_id"),
  githubRepo: text("github_repo"),
  maskingPolicyId: uuid("masking_policy_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const goldens = pgTable("goldens", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  auroraClusterId: text("aurora_cluster_id").notNull(),
  label: text("label").notNull(),
  lineageDepth: integer("lineage_depth").notNull().default(0),
  status: goldenStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  goldenId: uuid("golden_id").references(() => goldens.id),
  prNumber: integer("pr_number"),
  gitBranch: text("git_branch").notNull(),
  title: text("title"),
  dataMode: dataMode("data_mode").notNull().default("masked"),
  status: branchStatus("status").notNull().default("provisioning"),
  statusDetail: text("status_detail"),
  auroraClusterId: text("aurora_cluster_id"),
  instanceId: text("instance_id"),
  secretRef: text("secret_ref"),
  connectionHost: text("connection_host"),
  vercelDeploymentId: text("vercel_deployment_id"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  costCents: integer("cost_cents").notNull().default(0),
  source: text("source").notNull().default("dashboard"),
  migrationSql: text("migration_sql"),
  migrationDownSql: text("migration_down_sql"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const maskingPolicies = pgTable("masking_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const maskingRules = pgTable("masking_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => maskingPolicies.id, { onDelete: "cascade" }),
  tableName: text("table_name").notNull(),
  columnName: text("column_name").notNull(),
  fn: text("fn").notNull(),
  deterministic: boolean("deterministic").notNull().default(true),
});

export const deployRequests = pgTable("deploy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  prNumber: integer("pr_number"),
  baseRef: text("base_ref").notNull(),
  headRef: text("head_ref").notNull(),
  diffSql: text("diff_sql").notNull(),
  migrationSql: text("migration_sql"),
  migrationDownSql: text("migration_down_sql"),
  hasDestructive: boolean("has_destructive").notNull().default(false),
  lintFindings: jsonb("lint_findings")
    .$type<LintFinding[]>()
    .notNull()
    .default([]),
  status: deployStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  kind: jobKind("kind").notNull(),
  status: jobStatus("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  runAfter: timestamp("run_after", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
});

export type LintFinding = {
  rule: string;
  level: "warn" | "danger";
  message: string;
};

export type ConnectionConfig = {
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  goldenHost?: string;
  goldenDbName?: string;
  goldenMasterUser?: string;
  goldenMasterPassword?: string;
  dbSubnetGroupName?: string;
  dbSecurityGroupId?: string;
  vercelToken?: string;
  vercelTeamId?: string;
  vercelProjectId?: string;
  vercelEnvKey?: string;
  githubRepo?: string;
  githubToken?: string;
  githubWebhookSecret?: string;
  autoProvision?: boolean;
};

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  provisioner: text("provisioner").notNull().default("mock"),
  config: jsonb("config").$type<ConnectionConfig>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Connection = typeof connections.$inferSelect;

export type Project = typeof projects.$inferSelect;
export type Golden = typeof goldens.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type MaskingRule = typeof maskingRules.$inferSelect;
export type DeployRequest = typeof deployRequests.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type EventRow = typeof events.$inferSelect;
