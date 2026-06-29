"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Check,
  Copy,
  Database,
  EyeOff,
  GitBranch,
  GitPullRequest,
  RotateCcw,
  RotateCw,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityItemView } from "@/lib/views";
import { timeAgo } from "@/lib/format";
import { Skeleton } from "./ui";

type Meta = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: "leaf" | "amber" | "muted" | "alert";
};

const META: Record<string, Meta> = {
  created: { label: "Branch created", icon: GitBranch, tone: "leaf" },
  cloned: { label: "Clone ready", icon: Copy, tone: "leaf" },
  masked: { label: "PII masked", icon: EyeOff, tone: "leaf" },
  migrated: { label: "Migration applied to branch", icon: GitPullRequest, tone: "leaf" },
  ready: { label: "Ready", icon: Check, tone: "leaf" },
  deploy_request_opened: { label: "Deploy request opened", icon: GitPullRequest, tone: "leaf" },
  deploy_request_cancelled: {
    label: "Deploy request cancelled (branch pruned)",
    icon: X,
    tone: "muted",
  },
  preview_wired: { label: "Wired to Vercel preview", icon: GitPullRequest, tone: "leaf" },
  reset: { label: "Reset from prod", icon: RotateCw, tone: "amber" },
  torn_down: { label: "Pruned", icon: Trash2, tone: "muted" },
  error: { label: "Error", icon: TriangleAlert, tone: "alert" },
  deploy_applied: {
    label: "Migration applied",
    icon: GitPullRequest,
    tone: "leaf",
  },
  deploy_reverted: {
    label: "Migration rolled back",
    icon: RotateCcw,
    tone: "amber",
  },
  deploy_rejected: { label: "Deploy rejected", icon: X, tone: "alert" },
  masking_rule_added: {
    label: "Masking rule added",
    icon: Database,
    tone: "leaf",
  },
  masking_rule_removed: {
    label: "Masking rule removed",
    icon: Database,
    tone: "muted",
  },
  golden_added: { label: "Golden added", icon: Database, tone: "leaf" },
};

const TONE: Record<string, string> = {
  leaf: "text-leaf",
  amber: "text-amber",
  muted: "text-ink-faint",
  alert: "text-alert",
};

function subject(e: ActivityItemView): string {
  if (e.branchId) {
    const name = e.branchTitle ?? e.gitBranch ?? "branch";
    return e.prNumber ? `${name} · #${e.prNumber}` : name;
  }
  return e.detail ?? "";
}

export function ActivityClient() {
  const [events, setEvents] = useState<ActivityItemView[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setEvents((await api.activity()).events);
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? events.filter((e) => {
        const meta = META[e.type];
        return (
          subject(e).toLowerCase().includes(q) ||
          (meta?.label ?? e.type).toLowerCase().includes(q)
        );
      })
    : events;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Activity</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Audit trail of every branch, deploy and policy change — including
            pruned branches.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          className="w-48 rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink placeholder-ink-faint focus:border-leaf/60 focus:outline-none"
        />
      </div>

      <div className="card overflow-hidden rounded-xl border border-line bg-surface">
        <ul className="min-h-60 divide-y divide-line">
          {!loaded &&
            [0, 1, 2, 3, 4].map((i) => (
              <li key={`sk-${i}`} className="flex items-center gap-3 px-6 py-3.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="ml-auto h-3 w-12" />
              </li>
            ))}
          {loaded && filtered.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-ink-faint">
              No activity yet.
            </li>
          )}
          {loaded &&
            filtered.map((e) => {
            const meta = META[e.type] ?? {
              label: e.type,
              icon: GitBranch,
              tone: "muted" as const,
            };
            const Icon = meta.icon;
            return (
              <li
                key={e.id}
                className="fade-in flex items-center gap-3 px-6 py-3.5 transition hover:bg-raised"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-raised">
                  <Icon className={`h-4 w-4 ${TONE[meta.tone]}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">
                    {meta.label}
                    {subject(e) && (
                      <span className="text-ink-muted"> · {subject(e)}</span>
                    )}
                  </div>
                </div>
                <span className="font-mono shrink-0 text-[11px] text-ink-faint">
                  {timeAgo(e.ts)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
