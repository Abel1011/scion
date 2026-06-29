import { Check, ExternalLink, TriangleAlert } from "lucide-react";
import type { DeployRequestView } from "@/lib/views";
import { Skeleton } from "./ui";

function DiffLine({ line }: { line: string }) {
  const c = line[0];
  const cls =
    c === "+"
      ? "bg-leaf/10 text-leaf"
      : c === "-"
        ? "bg-alert/10 text-alert"
        : "text-ink-faint";
  return <span className={`block whitespace-pre px-3 py-0.5 ${cls}`}>{line}</span>;
}

export function DeployRequestCard({
  dr,
  busy,
  loading = false,
  onAction,
}: {
  dr: DeployRequestView | null;
  busy: boolean;
  loading?: boolean;
  onAction: (
    id: string,
    action: "apply" | "revert" | "reject",
    confirm?: boolean,
  ) => void;
}) {
  return (
    <div className="card flex min-h-90 flex-col rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-ink">Deploy Request</h2>
          {dr?.prNumber && (
            <span className="font-mono rounded-full bg-leaf/10 px-2 py-0.5 text-[11px] font-medium text-leaf">
              #{dr.prNumber}
            </span>
          )}
        </div>
        {dr && (
          <span className="font-mono text-xs text-ink-faint">
            {dr.headRef} → {dr.baseRef}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-24 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="ml-auto h-9 w-40" />
        </div>
      ) : !dr ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-ink-faint">
          No open deploy request.
        </div>
      ) : (
        <div className="flex-1 p-6">
          {dr.hasDestructive && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-alert/25 bg-alert/6 px-3.5 py-3 text-xs text-alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Destructive change</span> —
                drops a column (data loss). Approval required.
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-line bg-raised text-xs">
            <div className="font-mono border-b border-line px-3 py-2 text-ink-faint">
              migration · semantic diff
            </div>
            <pre className="font-mono overflow-x-auto leading-relaxed">
              <code>
                {dr.diffSql.split("\n").map((line, i) => (
                  <DiffLine key={i} line={line} />
                ))}
              </code>
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            {dr.lint.map((l, i) => (
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

          <div className="mt-5 flex items-center justify-end gap-2 text-sm">
            {dr.prUrl && (
              <a
                href={dr.prUrl}
                target="_blank"
                rel="noreferrer"
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 font-medium text-ink transition hover:bg-raised"
              >
                <ExternalLink className="h-3.5 w-3.5" /> GitHub PR #{dr.prNumber}
              </a>
            )}
            {dr.status === "open" || dr.status === "approved" ? (
              <>
                <button
                  disabled={busy}
                  onClick={() => onAction(dr.id, "reject")}
                  className="rounded-lg border border-line px-4 py-2 font-medium text-ink transition hover:bg-raised disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      dr.hasDestructive &&
                      !window.confirm(
                        "This change DELETES data on production. Apply anyway?",
                      )
                    )
                      return;
                    onAction(dr.id, "apply", dr.hasDestructive);
                  }}
                  className="rounded-lg bg-leaf px-4 py-2 font-bold text-white transition hover:bg-leaf-deep disabled:opacity-60"
                >
                  {busy ? "Applying…" : "Approve & apply"}
                </button>
              </>
            ) : dr.status === "applied" ? (
              <button
                disabled={busy}
                onClick={() => onAction(dr.id, "revert")}
                className="rounded-lg border border-alert/30 px-4 py-2 font-medium text-alert transition hover:bg-alert/10 disabled:opacity-60"
              >
                {busy ? "Reverting…" : "Revert"}
              </button>
            ) : (
              <span className="rounded-lg bg-raised px-4 py-2 font-medium capitalize text-ink-muted">
                {dr.status}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
