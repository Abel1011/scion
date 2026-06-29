"use client";

import { Database } from "lucide-react";
import type { BranchView, GoldenView } from "@/lib/views";
import { StatusBadge, ModeBadge } from "./badges";
import { Skeleton } from "./ui";

function dotClass(status: string) {
  if (status === "ready") return "bg-leaf";
  if (status === "paused") return "bg-ink-faint";
  if (status === "error") return "bg-alert";
  if (status === "deleted") return "bg-line";
  return "bg-amber animate-pulse"; // provisioning / masking / migrating
}

export function LineageTree({
  goldens,
  branches,
  loading = false,
  onOpen,
}: {
  goldens: GoldenView[];
  branches: BranchView[];
  loading?: boolean;
  onOpen: (b: BranchView) => void;
}) {
  const primary = goldens.find((g) => g.isPrimary) ?? goldens[0] ?? null;

  return (
    <div className="card mb-6 rounded-xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Production &amp; branches</h2>
        {loading ? (
          <Skeleton className="h-3 w-16" />
        ) : (
          <span className="font-mono text-[11px] text-ink-faint">
            {branches.length} {branches.length === 1 ? "branch" : "branches"}
          </span>
        )}
      </div>

      {/* Production root, always highlighted */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-leaf/30 bg-leaf/5 px-4 py-3">
        <Database className="h-4 w-4 text-leaf" />
        <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-leaf">
          Production
        </span>
        {loading ? (
          <Skeleton className="h-4 w-32 bg-leaf/10" />
        ) : (
          <>
            <span className="font-medium text-ink">{primary?.label ?? "—"}</span>
            {primary && (
              <span className="font-mono text-[11px] text-ink-faint">
                {primary.clusterId}
              </span>
            )}
            <span className="ml-auto font-mono text-xs text-leaf">
              {primary?.lineageDepth ?? 0}/15 clones
            </span>
          </>
        )}
      </div>

      {/* Branches hanging off production */}
      <div className="mt-1 pl-5">
        {loading ? (
          [0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 border-l-2 border-line py-2 pl-5"
            >
              <Skeleton className="-ml-1.75 h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="ml-auto h-5 w-20 rounded-full" />
            </div>
          ))
        ) : branches.length === 0 ? (
          <div className="border-l-2 border-line py-3 pl-5 text-sm text-ink-faint">
            No branches yet — grow one from production.
          </div>
        ) : (
          branches.map((b) => (
            <button
              key={b.id}
              onClick={() => onOpen(b)}
              className="group fade-in flex w-full items-center gap-2.5 border-l-2 border-line py-2 pl-5 text-left transition hover:border-leaf/50"
            >
              <span
                className={`-ml-1.75 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(b.status)}`}
              />
              <span className="font-mono truncate text-sm text-ink group-hover:text-leaf">
                {b.gitBranch}
              </span>
              {b.prNumber && (
                <span className="font-mono text-[11px] text-ink-faint">
                  #{b.prNumber}
                </span>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <ModeBadge mode={b.dataMode} />
                <StatusBadge status={b.status} />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
