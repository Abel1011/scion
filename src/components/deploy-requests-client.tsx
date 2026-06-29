"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  GitPullRequest,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import type { DeployRequestView } from "@/lib/views";
import { Skeleton } from "./ui";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber/10 text-amber",
  approved: "bg-amber/10 text-amber",
  applied: "bg-leaf/10 text-leaf",
  reverted: "bg-ink-faint/10 text-ink-muted",
  rejected: "bg-alert/10 text-alert",
};

function Status({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
        STATUS_CLASS[status] ?? STATUS_CLASS.open
      }`}
    >
      {status}
    </span>
  );
}

function Diff({ sql }: { sql: string }) {
  return (
    <pre className="font-mono overflow-x-auto leading-relaxed">
      <code>
        {sql.split("\n").map((line, i) => {
          const c = line[0];
          const cls =
            c === "+"
              ? "bg-leaf/10 text-leaf"
              : c === "-"
                ? "bg-alert/10 text-alert"
                : "text-ink-faint";
          return (
            <span key={i} className={`block whitespace-pre px-3 py-0.5 ${cls}`}>
              {line}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function TimelineStep({ label, at }: { label: string; at: string | null }) {
  if (!at) return null;
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
      <div>
        <div className="text-sm text-ink">{label}</div>
        <div className="font-mono text-[11px] text-ink-faint">
          {new Date(at).toLocaleString()}
        </div>
      </div>
    </li>
  );
}

export function DeployRequestsClient() {
  const [list, setList] = useState<DeployRequestView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { deployRequests } = await api.deployRequests();
      setList(deployRequests);
      setSelectedId((prev) => prev ?? deployRequests[0]?.id ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [load]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  };

  const act = async (
    id: string,
    action: "apply" | "revert" | "reject",
    confirm = false,
  ) => {
    setBusy(true);
    try {
      await api.deployAction(id, action, confirm);
      await load();
      showToast(
        action === "apply"
          ? "Migration applied"
          : action === "revert"
            ? "Migration rolled back"
            : "Deploy request rejected",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const recompute = async (id: string) => {
    setBusy(true);
    try {
      await api.recomputeDeploy(id);
      await load();
      showToast("Diff recomputed against current prod");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Recompute failed");
    } finally {
      setBusy(false);
    }
  };

  const selected = list.find((d) => d.id === selectedId) ?? null;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-9">
      <h1 className="text-3xl font-bold tracking-tight text-ink">
        Deploy Requests
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        History of schema changes across branches — review, apply, and roll
        back.
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden rounded-xl border border-line bg-surface lg:col-span-1">
          <div className="border-b border-line px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            {loaded ? `${list.length} changes` : "Loading…"}
          </div>
          <ul className="min-h-40 divide-y divide-line">
            {!loaded &&
              [0, 1, 2].map((i) => (
                <li
                  key={`sk-${i}`}
                  className="flex items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1.5 h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </li>
              ))}
            {loaded && list.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-faint">
                No schema changes yet.
              </li>
            )}
            {loaded &&
              list.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSelectedId(d.id)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-raised ${
                    d.id === selectedId ? "bg-leaf/5" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {d.branchTitle ?? d.headRef}
                    </div>
                    <div className="font-mono mt-0.5 text-[11px] text-ink-faint">
                      {d.prNumber ? `#${d.prNumber} · ` : ""}
                      {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Status status={d.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card rounded-xl border border-line bg-surface lg:col-span-2">
          {!loaded ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-28 w-full rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !selected ? (
            <div className="px-6 py-16 text-center text-sm text-ink-faint">
              Select a change to view its diff and history.
            </div>
          ) : (
            <div className="fade-in p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="h-4 w-4 text-leaf" />
                  <h2 className="font-bold text-ink">
                    {selected.branchTitle ?? selected.headRef}
                  </h2>
                  <Status status={selected.status} />
                </div>
                <span className="font-mono text-xs text-ink-faint">
                  {selected.headRef} → {selected.baseRef}
                </span>
              </div>

              {selected.hasDestructive && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-alert/25 bg-alert/6 px-3.5 py-3 text-xs text-alert">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Contains a destructive change (data loss).</span>
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-lg border border-line bg-raised text-xs">
                <div className="font-mono border-b border-line px-3 py-2 text-ink-faint">
                  migration · semantic diff
                </div>
                <Diff sql={selected.diffSql} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                {selected.lint.map((l, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                      l.level === "danger"
                        ? "bg-alert/10 text-alert"
                        : "bg-leaf/10 text-leaf"
                    }`}
                  >
                    {l.level === "danger" ? (
                      <TriangleAlert className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {l.message}
                  </span>
                ))}
              </div>

              <div className="mt-6">
                <div className="font-mono mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
                  History
                </div>
                <ol className="space-y-3">
                  <TimelineStep label="Created" at={selected.createdAt} />
                  <TimelineStep label="Applied" at={selected.appliedAt} />
                  <TimelineStep label="Rolled back" at={selected.revertedAt} />
                  {selected.status === "rejected" && (
                    <li className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-alert" />
                      <div className="text-sm text-ink">Rejected</div>
                    </li>
                  )}
                </ol>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 text-sm">
                {selected.prUrl ? (
                  <a
                    href={selected.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mr-auto inline-flex items-center gap-1.5 text-ink-muted transition hover:text-ink"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> GitHub PR #
                    {selected.prNumber}
                  </a>
                ) : (
                  <span className="mr-auto" />
                )}
                <button
                  onClick={() => recompute(selected.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 font-medium text-ink transition hover:bg-raised disabled:opacity-60"
                  title="Re-introspect clone vs current prod"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Recompute
                </button>
                {selected.status === "open" || selected.status === "approved" ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => act(selected.id, "reject")}
                      className="rounded-lg border border-line px-4 py-2 font-medium text-ink transition hover:bg-raised disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                      if (
                        selected.hasDestructive &&
                        !window.confirm(
                          "This change DELETES data on production. Apply anyway?",
                        )
                      )
                        return;
                      act(selected.id, "apply", selected.hasDestructive);
                    }}
                      className="rounded-lg bg-leaf px-4 py-2 font-bold text-white transition hover:bg-leaf-deep disabled:opacity-60"
                    >
                      Approve &amp; apply
                    </button>
                  </>
                ) : selected.status === "applied" ? (
                  <button
                    disabled={busy}
                    onClick={() => act(selected.id, "revert")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-alert/30 px-4 py-2 font-medium text-alert transition hover:bg-alert/10 disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4" /> Roll back
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        selected.hasDestructive &&
                        !window.confirm(
                          "This change DELETES data on production. Apply anyway?",
                        )
                      )
                        return;
                      act(selected.id, "apply", selected.hasDestructive);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 font-medium text-ink transition hover:bg-raised disabled:opacity-60"
                  >
                    <Clock className="h-4 w-4" /> Re-apply
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`pointer-events-none fixed bottom-5 right-5 z-50 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-paper shadow-2xl transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toast}
      </div>
    </main>
  );
}
