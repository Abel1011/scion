import postgres from "postgres";
import type { EffectiveConfig } from "@/lib/config";
import type { LintFinding } from "@/db/schema";

type Schema = Map<string, Map<string, string>>; // table -> column -> data_type

function connect(host: string, config: EffectiveConfig) {
  return postgres({
    host,
    port: 5432,
    database: config.goldenDbName,
    username: config.goldenMasterUser,
    password: config.goldenMasterPassword,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
}

async function introspect(host: string, config: EffectiveConfig): Promise<Schema> {
  const sql = connect(host, config);
  try {
    const rows = await sql`
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `;
    const schema: Schema = new Map();
    for (const r of rows) {
      const t = r.table_name as string;
      if (!schema.has(t)) schema.set(t, new Map());
      schema.get(t)!.set(r.column_name as string, r.data_type as string);
    }
    return schema;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Counts rows of the affected golden tables to quantify data at risk. */
async function countRows(
  host: string,
  tables: string[],
  config: EffectiveConfig,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (tables.length === 0) return out;
  const sql = connect(host, config);
  try {
    for (const t of tables) {
      try {
        const r = await sql.unsafe(`select count(*)::int n from "${t}"`);
        out.set(t, r[0].n as number);
      } catch {
        /* table may not exist */
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return out;
}

/** Real structural diff: what the branch (clone) adds/removes vs the golden. */
export async function diffGoldenVsClone(
  goldenHost: string,
  cloneHost: string,
  config: EffectiveConfig,
): Promise<{ diffSql: string; hasDestructive: boolean; lint: LintFinding[] }> {
  const [golden, clone] = await Promise.all([
    introspect(goldenHost, config),
    introspect(cloneHost, config),
  ]);

  const lines: string[] = [];
  const drops: { table: string; column?: string }[] = [];
  const typeChanges: string[] = [];
  let additions = 0;

  for (const t of [...new Set([...golden.keys(), ...clone.keys()])].sort()) {
    const g = golden.get(t);
    const c = clone.get(t);
    if (!g && c) {
      lines.push(`+ CREATE TABLE ${t} (`);
      for (const [col, type] of c) lines.push(`+   ${col} ${type},`);
      lines.push(`+ );`);
      additions++;
    } else if (g && !c) {
      lines.push(`- DROP TABLE ${t};`);
      drops.push({ table: t });
    } else if (g && c) {
      for (const [col, type] of c)
        if (!g.has(col)) {
          lines.push(`+ ALTER TABLE ${t} ADD COLUMN ${col} ${type};`);
          additions++;
        }
      for (const [col] of g)
        if (!c.has(col)) {
          lines.push(`- ALTER TABLE ${t} DROP COLUMN ${col};`);
          drops.push({ table: t, column: col });
        }
      for (const [col, type] of c) {
        const gt = g.get(col);
        if (gt && gt !== type) {
          lines.push(`~ ALTER TABLE ${t} ALTER COLUMN ${col} TYPE ${type};`);
          typeChanges.push(`${t}.${col}`);
        }
      }
    }
  }

  if (lines.length === 0) lines.push("  (no schema changes detected)");

  // Quantify rows at risk on the golden for every destructive change.
  const counts = await countRows(
    goldenHost,
    [...new Set(drops.map((d) => d.table))],
    config,
  );

  const lint: LintFinding[] = [];
  if (additions) {
    lint.push({
      rule: "additive",
      level: "warn",
      message: `${additions} additive change(s) — safe`,
    });
  }
  for (const d of drops) {
    const n = counts.get(d.table);
    const at = n == null ? "" : ` — ${n.toLocaleString()} row(s) at risk`;
    const target = d.column ? `${d.table}.${d.column}` : `table ${d.table}`;
    lint.push({
      rule: d.column ? "drop_column" : "drop_table",
      level: "danger",
      message: `Deletes ${target}${at}`,
    });
  }
  for (const tc of typeChanges) {
    lint.push({
      rule: "type_change",
      level: "warn",
      message: `Type change on ${tc} — review for truncation`,
    });
  }

  return { diffSql: lines.join("\n"), hasDestructive: drops.length > 0, lint };
}

/** Runs DDL against the golden (prod) cluster. Throws on conflict. */
export async function runDdlOnGolden(
  config: EffectiveConfig,
  statements: string[],
): Promise<void> {
  if (!config.goldenHost) throw new Error("Golden host not configured.");
  const sql = connect(config.goldenHost, config);
  try {
    for (const stmt of statements) await sql.unsafe(stmt);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
