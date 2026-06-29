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
  let lint: LintFinding[];
  if (hasDestructive) {
    // Identify what the change destroys. The real count of rows at risk comes
    // from production introspection in aws mode; this fallback only names the
    // target, it never fabricates a number.
    const col = sql.match(/alter\s+table\s+(\w+)\s+drop\s+column\s+(\w+)/i);
    const tbl = sql.match(/drop\s+table\s+(\w+)/i);
    const target = col ? `${col[1]}.${col[2]}` : tbl ? tbl[1] : "data";
    lint = [
      { rule: "data_loss", level: "danger", message: `Deletes ${target} (data loss)` },
    ];
  } else {
    lint = [{ rule: "additive", level: "warn", message: "Additive change, safe to apply" }];
  }

  return { diffSql, hasDestructive, lint };
}
