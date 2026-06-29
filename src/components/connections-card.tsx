"use client";

import { useEffect, useState } from "react";
import { Plug, Triangle } from "lucide-react";
import { api, type ConnectionInput, type VercelProjectItem } from "@/lib/api";
import type { ConnectionView } from "@/lib/views";
import { Select, fieldClass } from "./ui";

const field = fieldClass;

type SecretKey =
  | "awsAccessKeyId"
  | "awsSecretAccessKey"
  | "goldenMasterPassword"
  | "vercelToken"
  | "githubToken"
  | "githubWebhookSecret";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-mono mb-1 block text-[11px] uppercase tracking-wider text-ink-faint">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ConnectionsCard({ onToast }: { onToast: (m: string) => void }) {
  const [view, setView] = useState<ConnectionView | null>(null);
  const [provisioner, setProvisioner] = useState<"mock" | "aws">("mock");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [vProjects, setVProjects] = useState<VercelProjectItem[]>([]);
  const [envKeys, setEnvKeys] = useState<string[]>([]);
  const [repos, setRepos] = useState<string[]>([]);
  const [autoProvision, setAutoProvision] = useState(false);

  const load = async () => {
    try {
      const v = await api.connections();
      setView(v);
      setProvisioner(v.provisioner);
      setAutoProvision(!!v.autoProvision);
      setForm({
        awsRegion: v.awsRegion ?? "",
        goldenHost: v.goldenHost ?? "",
        goldenDbName: v.goldenDbName ?? "",
        goldenMasterUser: v.goldenMasterUser ?? "",
        dbSubnetGroupName: v.dbSubnetGroupName ?? "",
        dbSecurityGroupId: v.dbSecurityGroupId ?? "",
        vercelTeamId: v.vercelTeamId ?? "",
        vercelProjectId: v.vercelProjectId ?? "",
        vercelEnvKey: v.vercelEnvKey ?? "DATABASE_URL",
        githubRepo: v.githubRepo ?? "",
        awsAccessKeyId: "",
        awsSecretAccessKey: "",
        goldenMasterPassword: "",
        vercelToken: "",
        githubToken: "",
        githubWebhookSecret: "",
      });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Once a Vercel token is configured, load the project list for the selector.
  useEffect(() => {
    if (!view?.set?.vercelToken) return;
    api
      .vercelProjects()
      .then((r) => setVProjects(r.projects))
      .catch(() => setVProjects([]));
    api
      .vercelEnvKeys()
      .then((r) => setEnvKeys(r.keys))
      .catch(() => setEnvKeys([]));
  }, [view?.set?.vercelToken]);

  // Once a GitHub token is configured, load the repo list for the selector.
  useEffect(() => {
    if (!view?.set?.githubToken) return;
    api
      .githubRepos()
      .then((r) => setRepos(r.repos.map((x) => x.fullName)))
      .catch(() => setRepos([]));
  }, [view?.set?.githubToken]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.updateConnections({
        provisioner,
        ...form,
        autoProvision,
      } as ConnectionInput);
      await load();
      onToast("Connection saved");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const text = (k: string, label: string, mono = true, placeholder?: string) => (
    <Labeled label={label}>
      <input
        className={`${field} ${mono ? "font-mono" : ""}`}
        value={form[k] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)}
      />
    </Labeled>
  );

  const secret = (k: SecretKey, label: string) => (
    <Labeled label={label}>
      <input
        type="password"
        className={`${field} font-mono`}
        value={form[k] ?? ""}
        placeholder={
          view?.set[k] ? "•••• configured — blank keeps it" : "not set"
        }
        onChange={(e) => set(k, e.target.value)}
      />
    </Labeled>
  );

  return (
    <section className="card mt-6 rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-leaf" />
          <h2 className="text-lg font-bold text-ink">Connections (BYOK)</h2>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-leaf px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-leaf-deep disabled:opacity-60"
        >
          Save
        </button>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <div className="font-mono mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
            Provisioner
          </div>
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(["mock", "aws"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvisioner(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  provisioner === p
                    ? "bg-leaf/10 text-leaf"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {p === "mock" ? "Mock" : "AWS (real)"}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <div className="font-mono mb-3 text-[11px] uppercase tracking-wider text-ink-faint">
            Amazon Aurora
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {text("awsRegion", "Region", true, "us-east-1")}
            {secret("awsAccessKeyId", "Access key ID")}
            {secret("awsSecretAccessKey", "Secret access key")}
            {text("goldenHost", "Golden cluster host")}
            {text("goldenDbName", "Golden DB name")}
            {text("goldenMasterUser", "Master user")}
            {secret("goldenMasterPassword", "Master password")}
            {text("dbSubnetGroupName", "Subnet group")}
            {text("dbSecurityGroupId", "Security group ID")}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <div className="font-mono mb-3 text-[11px] uppercase tracking-wider text-ink-faint">
            Vercel
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {secret("vercelToken", "API token")}
            {text("vercelTeamId", "Team ID (optional)")}
            <Labeled label="Project">
              {vProjects.length ? (
                <Select
                  value={form.vercelProjectId ?? ""}
                  onChange={(e) => set("vercelProjectId", e.target.value)}
                >
                  <option value="">Select a project…</option>
                  {vProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.db?.isGolden ? " · branchable" : ""}
                    </option>
                  ))}
                </Select>
              ) : (
                <input
                  className={`${field} font-mono`}
                  value={form.vercelProjectId ?? ""}
                  placeholder={
                    view?.set?.vercelToken
                      ? "Loading projects…"
                      : "Add token first"
                  }
                  onChange={(e) => set("vercelProjectId", e.target.value)}
                />
              )}
            </Labeled>
            <Labeled label="Inject as env var">
              <input
                className={`${field} font-mono`}
                list="vercel-env-keys"
                value={form.vercelEnvKey ?? ""}
                placeholder="DATABASE_URL"
                onChange={(e) => set("vercelEnvKey", e.target.value)}
              />
              <datalist id="vercel-env-keys">
                {envKeys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Labeled>
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <div className="font-mono mb-3 text-[11px] uppercase tracking-wider text-ink-faint">
            GitHub
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {secret("githubToken", "Token")}
            {secret("githubWebhookSecret", "Webhook secret")}
            <div className="sm:col-span-2">
              <Labeled label="Repository">
                {repos.length ? (
                  <Select
                    value={form.githubRepo ?? ""}
                    onChange={(e) => set("githubRepo", e.target.value)}
                  >
                    <option value="">Select a repository…</option>
                    {repos.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <input
                    className={`${field} font-mono`}
                    value={form.githubRepo ?? ""}
                    placeholder={
                      view?.set?.githubToken
                        ? "Loading repositories…"
                        : "owner/repo (add token to pick from a list)"
                    }
                    onChange={(e) => set("githubRepo", e.target.value)}
                  />
                )}
              </Labeled>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={autoProvision}
              onChange={(e) => setAutoProvision(e.target.checked)}
              className="h-4 w-4 accent-leaf"
            />
            <span>
              Auto-provision on PR webhook
              <span className="ml-1 text-xs text-ink-faint">
                (off by default — create branches manually)
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-line bg-raised px-3 py-2.5 text-xs text-ink-muted">
          <Triangle className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
          <span>
            Secrets are write-only — never returned to the browser. In
            production they would be encrypted at rest (KMS / Secrets Manager).
            Values set here override the env defaults.
          </span>
        </div>
      </div>
    </section>
  );
}
