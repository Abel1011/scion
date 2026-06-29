import { NextResponse } from "next/server";
import postgres from "postgres";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shown when no live golden is reachable (mock mode) so the masking picker still
// has something to choose from.
const SAMPLE = [
  { name: "users", columns: ["id", "name", "email", "card"] },
  {
    name: "orders",
    columns: ["id", "user_id", "status", "total_cents", "shipping_address", "created_at"],
  },
  { name: "products", columns: ["id", "name", "sku", "category", "price_cents", "stock"] },
];

// Introspects the golden schema so the masking policy can pick tables and
// columns from a list instead of typing them by hand.
export async function GET() {
  const config = await getConfig();
  if (config.provisioner !== "aws" || !config.goldenHost) {
    return NextResponse.json({ tables: SAMPLE });
  }

  let sql: ReturnType<typeof postgres> | undefined;
  try {
    sql = postgres({
      host: config.goldenHost,
      port: 5432,
      database: config.goldenDbName,
      username: config.goldenMasterUser,
      password: config.goldenMasterPassword,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
    const rows = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `;
    const map = new Map<string, string[]>();
    for (const r of rows) {
      if (!map.has(r.table_name)) map.set(r.table_name, []);
      map.get(r.table_name)!.push(r.column_name);
    }
    const tables = [...map.entries()].map(([name, columns]) => ({ name, columns }));
    return NextResponse.json({ tables: tables.length ? tables : SAMPLE });
  } catch {
    return NextResponse.json({ tables: SAMPLE });
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}
