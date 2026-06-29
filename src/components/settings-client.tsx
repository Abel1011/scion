"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Database } from "lucide-react";
import { api } from "@/lib/api";
import type { MaskingRuleView } from "@/lib/views";
import { MASK_LABEL, type MaskFn } from "@/lib/masking/rules";
import { ConnectionsCard } from "./connections-card";
import { Select, Skeleton } from "./ui";

const FUNCTIONS: MaskFn[] = [
  "mask_email",
  "mask_name",
  "mask_card",
  "mask_phone",
  "mask_address",
  "nullify",
];

export function SettingsClient() {
  const [rules, setRules] = useState<MaskingRuleView[]>([]);
  const [schema, setSchema] = useState<{ name: string; columns: string[] }[]>([]);
  const [table, setTable] = useState("users");
  const [column, setColumn] = useState("");
  const [fn, setFn] = useState<string>("mask_email");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const [r, s] = await Promise.all([api.maskingRules(), api.schema()]);
      setRules(r.rules);
      setSchema(s.tables);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Default the masking picker to the first discovered table once the schema loads.
  useEffect(() => {
    if (schema.length && !schema.some((t) => t.name === table)) {
      setTable(schema[0].name);
      setColumn(schema[0].columns[0] ?? "");
    }
  }, [schema, table]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      showToast(msg);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const addRule = () => {
    if (!table.trim() || !column.trim()) return;
    run(
      () =>
        api
          .addMaskingRule({
            tableName: table.trim(),
            columnName: column.trim(),
            fn,
          })
          .then(() => setColumn("")),
      "Rule added",
    );
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-9">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Settings</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Configure the masking policy and the credentials Scion connects with.
      </p>

      <section className="card mt-7 rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-6 py-4">
          <Database className="h-4 w-4 text-leaf" />
          <h2 className="text-lg font-bold text-ink">Masking policy</h2>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="py-2 font-semibold">Table</th>
                <th className="py-2 font-semibold">Column</th>
                <th className="py-2 font-semibold">Function</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!loaded &&
                [0, 1, 2].map((i) => (
                  <tr key={`sk-${i}`}>
                    <td className="py-2.5">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-2.5">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-2.5">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="py-2.5" />
                  </tr>
                ))}
              {loaded && rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-ink-faint">
                    No masking rules yet.
                  </td>
                </tr>
              )}
              {loaded &&
                rules.map((r) => (
                  <tr key={r.id} className="fade-in">
                  <td className="font-mono py-2.5 text-ink">{r.tableName}</td>
                  <td className="font-mono py-2.5 text-ink">{r.columnName}</td>
                  <td className="py-2.5 text-ink-muted">
                    {MASK_LABEL[r.fn as MaskFn] ?? r.fn}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() =>
                        run(() => api.deleteMaskingRule(r.id), "Rule removed")
                      }
                      className="rounded-md p-1.5 text-ink-faint transition hover:bg-alert/10 hover:text-alert"
                      aria-label="Remove rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <div className="w-44">
              <Select
                className="font-mono"
                value={table}
                onChange={(e) => {
                  setTable(e.target.value);
                  const t = schema.find((x) => x.name === e.target.value);
                  setColumn(t?.columns[0] ?? "");
                }}
              >
                {schema.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select
                className="font-mono"
                value={column}
                onChange={(e) => setColumn(e.target.value)}
              >
                <option value="">column…</option>
                {(schema.find((t) => t.name === table)?.columns ?? []).map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </Select>
            </div>
            <div className="w-48">
              <Select value={fn} onChange={(e) => setFn(e.target.value)}>
                {FUNCTIONS.map((f) => (
                  <option key={f} value={f}>
                    {MASK_LABEL[f]}
                  </option>
                ))}
              </Select>
            </div>
            <button
              onClick={addRule}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-leaf px-3.5 py-2 text-sm font-bold text-white transition hover:bg-leaf-deep disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add rule
            </button>
          </div>
        </div>
      </section>

      <ConnectionsCard onToast={showToast} />

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
