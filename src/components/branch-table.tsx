"use client";

import { useState } from "react";
import type { BranchView } from "@/lib/views";
import { StatusBadge, ModeBadge } from "./badges";
import { Skeleton } from "./ui";
import { formatCents, timeLeft } from "@/lib/format";

type Props = {
  branches: BranchView[];
  loading?: boolean;
  onOpen: (b: BranchView) => void;
  onExplore: (b: BranchView) => void;
  onReset: (b: BranchView) => void;
  onTeardown: (b: BranchView) => void;
};

export function BranchTable({
  branches,
  loading = false,
  onOpen,
  onExplore,
  onReset,
  onTeardown,
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? branches.filter(
        (b) =>
          (b.title ?? "").toLowerCase().includes(q) ||
          b.gitBranch.toLowerCase().includes(q),
      )
    : branches;

  return (
    <div className="card mb-6 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-lg font-bold text-ink">Active branches</h2>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="w-40 rounded-lg border border-line bg-raised px-3 py-1.5 text-sm text-ink placeholder-ink-faint focus:border-leaf/60 focus:outline-none"
          />
          {loading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="font-mono text-xs text-ink-faint">
              {filtered.length} live
            </span>
          )}
        </div>
      </div>
      <div className="min-h-60 overflow-x-auto">
      <table className="w-full min-w-170 text-sm">
        <thead>
          <tr className="font-mono border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint">
            <th className="px-6 py-3 font-semibold">Branch / PR</th>
            <th className="px-6 py-3 font-semibold">Status</th>
            <th className="px-6 py-3 font-semibold">Mode</th>
            <th className="px-6 py-3 font-semibold">Cost</th>
            <th className="px-6 py-3 font-semibold">Prunes in</th>
            <th className="px-6 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading &&
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-6 w-28 rounded-md" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-12" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-14" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="ml-auto h-4 w-28" />
                </td>
              </tr>
            ))}
          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-ink-faint">
                {branches.length === 0
                  ? "No branches yet — grow one."
                  : "No matches."}
              </td>
            </tr>
          )}
          {!loading &&
            filtered.map((b) => {
            const ready = b.status === "ready";
            return (
              <tr key={b.id} className="fade-in transition hover:bg-raised">
                <td className="px-6 py-4">
                  <button
                    onClick={() => onOpen(b)}
                    className="text-left font-medium text-ink transition hover:text-leaf"
                  >
                    {b.title ?? b.gitBranch}
                  </button>
                  <div className="font-mono mt-0.5 text-xs text-ink-faint">
                    {b.prNumber ? `#${b.prNumber} · ` : ""}
                    {b.gitBranch}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-6 py-4">
                  <ModeBadge mode={b.dataMode} />
                </td>
                <td className="px-6 py-4 font-mono text-ink-muted">
                  {formatCents(b.costCents)}
                </td>
                <td className="px-6 py-4 font-mono text-ink-muted">
                  {timeLeft(b.leaseExpiresAt)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1 text-xs">
                    <button
                      disabled={!ready}
                      onClick={() => onExplore(b)}
                      className="rounded-md px-2 py-1 text-ink-muted transition enabled:hover:bg-raised enabled:hover:text-ink disabled:text-ink-faint"
                    >
                      Explore
                    </button>
                    <button
                      disabled={!ready && b.status !== "error"}
                      onClick={() => onReset(b)}
                      className="rounded-md px-2 py-1 text-ink-muted transition enabled:hover:bg-raised enabled:hover:text-ink disabled:text-ink-faint"
                    >
                      {b.status === "error" ? "Retry" : "Reset"}
                    </button>
                    <button
                      onClick={() => onTeardown(b)}
                      className="rounded-md px-2 py-1 font-medium text-alert transition hover:bg-alert/10"
                    >
                      Prune
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
