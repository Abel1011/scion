import { EyeOff, Copy } from "lucide-react";
import type { MaskedData } from "@/lib/api";

export function MaskedDataCard({
  data,
  branchLabel,
  host,
  onCopy,
}: {
  data: MaskedData | null;
  branchLabel: string | null;
  host?: string | null;
  onCopy: () => void;
}) {
  return (
    <div className="card flex min-h-90 flex-col rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-lg font-bold text-ink">
          Data —{" "}
          <span className="font-mono text-sm text-ink-muted">
            {data?.table ?? "users"}
          </span>
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/25 bg-leaf/5 px-2.5 py-1 text-[11px] font-medium text-leaf">
          <EyeOff className="h-3 w-3" /> PII masked
        </span>
      </div>

      {!data ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-ink-faint">
          {branchLabel
            ? "Loading masked rows…"
            : "Explore a ready branch to preview its masked data."}
        </div>
      ) : data.rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-ink-faint">
          No rows — schema-only branch.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto p-1.5">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  {data.columns.map((c) => (
                    <th key={c} className="px-4 py-2.5 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono divide-y divide-line text-ink">
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    {data.columns.map((c, j) => (
                      <td
                        key={c}
                        className={`px-4 py-2.5 ${j === 0 ? "text-ink-faint" : ""}`}
                      >
                        {r[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-6 py-3 text-[11px] text-ink-muted">
            Deterministic, FK-safe pseudonymization — joins stay intact, zero
            real PII.
          </div>
        </>
      )}

      <div className="mt-auto border-t border-line px-6 py-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-raised px-3 py-2">
          <code className="font-mono truncate text-xs text-ink-muted">
            {host
              ? `postgres://scion:••••@${host}:5432/shop`
              : "Explore a ready branch to get its connection string"}
          </code>
          <button
            onClick={onCopy}
            className="shrink-0 rounded-md p-1 text-ink-faint transition hover:bg-line hover:text-ink"
            aria-label="Copy connection string"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
