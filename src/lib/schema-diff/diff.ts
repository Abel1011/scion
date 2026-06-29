import type { LintFinding } from "@/db/schema";

export type SchemaDiff = {
  diffSql: string;
  hasDestructive: boolean;
  lint: LintFinding[];
};

/**
 * Builds a deploy-request diff from the branch's own migration SQL. Used when a
 * real golden-vs-clone introspection isn't available (mock mode). It reflects
 * the actual migration the user submitted, not a canned sample.
 */
export function computeSchemaDiff(migrationSql?: string | null): SchemaDiff {
  const sql = (migrationSql ?? "").trim();
  if (!sql) {
    return { diffSql: "  (no schema changes)", hasDestructive: false, lint: [] };
  }

  const diffSql = sql
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (/\bdrop\b/i.test(l)) return `- ${l}`;
      if (/\b(add|create)\b/i.test(l)) return `+ ${l}`;
      return `  ${l}`;
    })
    .join("\n");

  const hasDestructive = /\bdrop\s+(column|table)\b/i.test(sql);
  const lint: LintFinding[] = hasDestructive
    ? [{ rule: "data_loss", level: "danger", message: "Drops a column/table (data loss)" }]
    : [{ rule: "additive", level: "warn", message: "Additive change — safe" }];

  return { diffSql, hasDestructive, lint };
}
