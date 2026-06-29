"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Copy,
  Link2,
  Pause,
  Play,
  RotateCw,
  Trash2,
  Triangle,
  X,
} from "lucide-react";
import { api, type BranchDetail, type PreviewDeployment } from "@/lib/api";
import { StatusBadge, ModeBadge } from "./badges";
import { Select, Skeleton } from "./ui";
import { formatCents, timeLeft } from "@/lib/format";

const EVENT_LABEL: Record<string, string> = {
  created: "Branch created",
  cloned: "Copy-on-write clone ready",
  masked: "PII masked",
  migrated: "Migration applied",
  ready: "Ready",
  preview_wired: "Wired to Vercel preview",
  deploy_request_cancelled: "Deploy request cancelled (branch pruned)",
  torn_down: "Pruned",
  error: "Error",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export function BranchDetailDrawer({
  branchId,
  onClose,
  onTeardown,
  onToast,
}: {
  branchId: string | null;
  onClose: () => void;
  onTeardown: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<BranchDetail | null>(null);
  const [previews, setPreviews] = useState<PreviewDeployment[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [targetBranch, setTargetBranch] = useState("");

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      setDetail(await api.branchDetail(branchId));
    } catch {
      /* ignore */
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setDetail(null);
      return;
    }
    load();
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [branchId, load]);

  if (!branchId) return null;

  const b = detail?.branch;
  const host = b?.connectionHost ?? null;
  const connection = host
    ? `postgres://scion:••••@${host}:5432/shop`
    : "Provisioning — connection pending";

  const copy = async () => {
    if (!host) {
      onToast("Connection not ready yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(connection);
    } catch {
      /* clipboard may be unavailable */
    }
    onToast("Connection string copied");
  };

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      onToast(msg);
      await load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Action failed");
    }
  };

  const wire = async (gitBranch?: string) => {
    try {
      const r = await api.wireBranch(branchId, gitBranch);
      onToast(`Wired to preview · ${r.gitBranch}`);
      setShowCustom(false);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to wire preview");
    }
  };

  const openCustom = async () => {
    setShowCustom(true);
    try {
      const r = await api.vercelPreviews();
      setPreviews(r.previews);
      setTargetBranch(r.previews[0]?.gitBranch ?? "");
    } catch {
      /* ignore */
    }
  };

  const actionable = b?.status === "ready" || b?.status === "paused";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fade-in flex-1 bg-ink/30" onClick={onClose} />
      <aside className="slide-in-right w-full max-w-md overflow-y-auto border-l border-line bg-surface">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-ink">
              {b?.title ?? b?.gitBranch ?? "Branch"}
            </h2>
            <p className="font-mono mt-0.5 truncate text-xs text-ink-faint">
              {b?.prNumber ? `#${b.prNumber} · ` : ""}
              {b?.gitBranch}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-faint hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!detail ? (
          <div className="space-y-6 p-5">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-md" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ) : (
          <div className="fade-in space-y-6 p-5">
            <div className="flex items-center gap-2">
              {b && <StatusBadge status={b.status} />}
              {b && <ModeBadge mode={b.dataMode} />}
            </div>

            <div className="rounded-lg border border-line bg-raised p-3">
              <Row label="Cost / month" value={formatCents(b?.costCents ?? 0)} />
              <Row label="Prunes in" value={timeLeft(b?.leaseExpiresAt)} />
              <Row label="Cluster host" value={host ?? "pending"} />
            </div>

            <div>
              <div className="font-mono mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
                Connection
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-raised px-3 py-2">
                <code className="font-mono truncate text-xs text-ink-muted">
                  {connection}
                </code>
                <button
                  onClick={copy}
                  className="shrink-0 rounded-md p-1 text-ink-faint hover:bg-line hover:text-ink"
                  aria-label="Copy"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {host && (
              <div>
                <div className="font-mono mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-faint">
                  <Triangle className="h-3 w-3" /> Vercel preview
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => wire()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-raised"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Send to last preview
                  </button>
                  <button
                    onClick={openCustom}
                    className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-raised"
                  >
                    Select custom preview
                  </button>
                </div>
                {showCustom &&
                  (previews.length ? (
                    <div className="mt-2 flex gap-2">
                      <div className="flex-1">
                        <Select
                          value={targetBranch}
                          onChange={(e) => setTargetBranch(e.target.value)}
                        >
                          {previews.map((p) => (
                            <option key={p.uid} value={p.gitBranch}>
                              {p.gitBranch}
                              {p.prNumber ? ` · #${p.prNumber}` : ""}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <button
                        onClick={() => wire(targetBranch)}
                        disabled={!targetBranch}
                        className="rounded-lg bg-leaf px-3 py-2 text-xs font-bold text-white transition hover:bg-leaf-deep disabled:opacity-60"
                      >
                        Wire
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-faint">
                      No previews found — set a Vercel project in Settings, or
                      open a PR on the repo.
                    </p>
                  ))}
              </div>
            )}

            <div>
              <div className="font-mono mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
                Timeline
              </div>
              <ol className="space-y-3">
                {detail.events.length === 0 && (
                  <li className="text-sm text-ink-faint">No events yet.</li>
                )}
                {detail.events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                    <div className="min-w-0">
                      <div className="text-sm text-ink">
                        {EVENT_LABEL[e.type] ?? e.type}
                      </div>
                      <div className="font-mono text-[11px] text-ink-faint">
                        {new Date(e.ts).toLocaleTimeString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {detail.data && detail.data.rows.length > 0 && (
              <div>
                <div className="font-mono mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
                  Masked data · {detail.data.table}
                </div>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-left text-xs">
                    <tbody className="font-mono divide-y divide-line text-ink">
                      {detail.data.rows.slice(0, 6).map((r, i) => (
                        <tr key={i}>
                          {detail.data!.columns.slice(0, 4).map((c, j) => (
                            <td
                              key={c}
                              className={`px-3 py-2 ${j === 0 ? "" : "text-ink-muted"}`}
                            >
                              {r[c]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detail.deployRequest && (
              <div className="rounded-lg border border-line bg-raised p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Deploy request</span>
                  <span className="font-mono text-ink">
                    #{detail.deployRequest.prNumber} ·{" "}
                    {detail.deployRequest.status}
                  </span>
                </div>
              </div>
            )}

            {actionable && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    act(() => api.resetBranch(branchId), "Re-cloning from prod…")
                  }
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-2 text-xs font-medium text-ink transition hover:bg-raised"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Reset
                </button>
                <button
                  onClick={() =>
                    act(
                      () => api.pauseBranch(branchId),
                      b?.status === "ready" ? "Paused" : "Resumed",
                    )
                  }
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-2 text-xs font-medium text-ink transition hover:bg-raised"
                >
                  {b?.status === "ready" ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Resume
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    act(() => api.renewBranch(branchId), "Lease renewed")
                  }
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-2 text-xs font-medium text-ink transition hover:bg-raised"
                >
                  <Clock className="h-3.5 w-3.5" /> Renew
                </button>
              </div>
            )}

            {b?.status === "error" && (
              <button
                onClick={() =>
                  act(() => api.resetBranch(branchId), "Retrying provisioning…")
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-raised"
              >
                <RotateCw className="h-4 w-4" /> Retry provisioning
              </button>
            )}

            <button
              onClick={() => {
                onTeardown(branchId);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-alert/30 px-4 py-2 text-sm font-medium text-alert transition hover:bg-alert/10"
            >
              <Trash2 className="h-4 w-4" /> Prune branch
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
