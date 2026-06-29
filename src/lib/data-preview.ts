import postgres from "postgres";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { maskingPolicies, maskingRules } from "@/db/schema";
import type { EffectiveConfig } from "@/lib/config";
import { SAMPLE_COLUMNS, SAMPLE_MASKED_USERS } from "@/lib/sample-data";

export type DataPreview = {
  table: string;
  columns: string[];
  rows: Record<string, string>[];
};

const SAMPLE: DataPreview = {
  table: "users",
  columns: SAMPLE_COLUMNS,
  rows: SAMPLE_MASKED_USERS,
};

/** Prefer a table that has masking rules; otherwise the first public table. */
async function preferredTable(
  projectId: string,
  sql: ReturnType<typeof postgres>,
): Promise<string | null> {
  if (projectId) {
    const ruled = await db
      .select({ t: maskingRules.tableName })
      .from(maskingRules)
      .innerJoin(maskingPolicies, eq(maskingRules.policyId, maskingPolicies.id))
      .where(eq(maskingPolicies.projectId, projectId))
      .limit(1);
    if (ruled.length) return ruled[0].t;
  }
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name limit 1
  `;
  return rows[0]?.table_name ?? null;
}

/**
 * Reads a 50-row preview of a branch's clone. Generic over the schema (columns
 * are discovered, not hardcoded). Falls back to the sample set in mock mode or
 * if the clone is unreachable.
 */
export async function fetchBranchData(opts: {
  projectId: string;
  host: string | null;
  config: EffectiveConfig;
}): Promise<DataPreview> {
  const { projectId, host, config } = opts;
  if (config.provisioner !== "aws" || !host) return SAMPLE;

  let sql: ReturnType<typeof postgres> | undefined;
  try {
    sql = postgres({
      host,
      port: 5432,
      database: config.goldenDbName,
      username: config.goldenMasterUser,
      password: config.goldenMasterPassword,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });

    const table = await preferredTable(projectId, sql);
    if (!table) return SAMPLE;

    const colRows = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${table}
      order by ordinal_position
    `;
    const columns = colRows.map((r) => r.column_name);
    if (!columns.length) return SAMPLE;

    const sel = columns.map((c) => `"${c}"`).join(", ");
    const data = await sql.unsafe(
      `select ${sel} from "${table}" order by 1 limit 50`,
    );
    const rows = data.map((r) =>
      Object.fromEntries(
        columns.map((c) => [c, r[c] == null ? "" : String(r[c])]),
      ),
    );
    return { table, columns, rows };
  } catch {
    return SAMPLE;
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}
