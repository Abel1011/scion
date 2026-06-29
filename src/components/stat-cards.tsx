import type { Stats } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { Skeleton } from "./ui";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="card rounded-xl border border-line bg-surface p-5">{children}</div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
      {children}
    </p>
  );
}

export function StatCards({ stats }: { stats: Stats | null }) {
  const loading = !stats;
  const lineageUsed = stats?.lineageUsed ?? 0;
  const lineageTotal = stats?.lineageTotal ?? 15;
  const pct = lineageTotal ? Math.round((lineageUsed / lineageTotal) * 100) : 0;

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <Label>Live branches</Label>
        {loading ? (
          <Skeleton className="mt-2 h-9 w-12" />
        ) : (
          <p className="mt-2 text-4xl font-bold text-ink fade-in">
            {stats.activeBranches}
          </p>
        )}
        <p className="mt-1 text-xs text-leaf">copy-on-write</p>
      </Card>
      <Card>
        <Label>Clone lineage</Label>
        {loading ? (
          <Skeleton className="mt-2 h-9 w-16" />
        ) : (
          <p className="mt-2 text-4xl font-bold text-ink fade-in">
            {lineageUsed}
            <span className="text-xl text-ink-faint">/{lineageTotal}</span>
          </p>
        )}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-amber transition-[width] duration-500"
            style={{ width: `${loading ? 0 : pct}%` }}
          />
        </div>
      </Card>
      <Card>
        <Label>Cost / month</Label>
        {loading ? (
          <Skeleton className="mt-2 h-9 w-20" />
        ) : (
          <p className="mt-2 text-4xl font-bold text-ink fade-in">
            {formatCents(stats.costCents)}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-muted">CoW deltas only</p>
      </Card>
      <Card>
        <Label>Isolation</Label>
        <p className="mt-2 text-4xl font-bold text-ink">Full</p>
        <p className="mt-1 text-xs text-ink-muted">dedicated cluster</p>
      </Card>
    </div>
  );
}
