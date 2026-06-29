"use client";

import { useState } from "react";
import { Sprout, X } from "lucide-react";
import type { CreateBranchInput } from "@/lib/api";
import { Select, fieldClass } from "./ui";

const MODES = [
  { value: "masked", label: "Masked clone" },
  { value: "schema_only", label: "Schema-only" },
];

export function NewBranchModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateBranchInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [dataMode, setDataMode] = useState("masked");
  const [migrationSql, setMigrationSql] = useState("");
  const [migrationDownSql, setMigrationDownSql] = useState("");

  if (!open) return null;

  const field = fieldClass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card fade-in w-full max-w-md rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-leaf" />
            <h2 className="font-bold text-ink">Grow a branch</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-faint hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="font-mono mb-1 block text-[11px] uppercase tracking-wider text-ink-faint">
              Title
            </label>
            <input
              className={field}
              placeholder="Add gift-card checkout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block text-[11px] uppercase tracking-wider text-ink-faint">
              Git branch
            </label>
            <input
              className={`${field} font-mono`}
              placeholder="feat/gift-cards"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block text-[11px] uppercase tracking-wider text-ink-faint">
              Data mode
            </label>
            <Select
              value={dataMode}
              onChange={(e) => setDataMode(e.target.value)}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="font-mono mb-1 block text-[11px] uppercase tracking-wider text-ink-faint">
              Migration SQL (optional)
            </label>
            <textarea
              className={`${field} font-mono h-20 resize-y`}
              placeholder="ALTER TABLE users ADD COLUMN loyalty_points int DEFAULT 0;"
              value={migrationSql}
              onChange={(e) => setMigrationSql(e.target.value)}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block text-[11px] uppercase tracking-wider text-ink-faint">
              Down / revert SQL (optional)
            </label>
            <textarea
              className={`${field} font-mono h-16 resize-y`}
              placeholder="ALTER TABLE users DROP COLUMN loyalty_points;"
              value={migrationDownSql}
              onChange={(e) => setMigrationDownSql(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-raised"
          >
            Cancel
          </button>
          <button
            disabled={submitting}
            onClick={() =>
              onSubmit({
                title: title || undefined,
                gitBranch: gitBranch || undefined,
                dataMode,
                migrationSql: migrationSql || undefined,
                migrationDownSql: migrationDownSql || undefined,
              })
            }
            className="rounded-lg bg-leaf px-4 py-2 text-sm font-bold text-white transition hover:bg-leaf-deep disabled:opacity-60"
          >
            {submitting ? "Growing…" : "Grow branch"}
          </button>
        </div>
      </div>
    </div>
  );
}
