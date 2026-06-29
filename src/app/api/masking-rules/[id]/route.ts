import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { maskingRules } from "@/db/schema";
import { logEvent } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [rule] = await db
    .select()
    .from(maskingRules)
    .where(eq(maskingRules.id, id));
  await db.delete(maskingRules).where(eq(maskingRules.id, id));
  if (rule) {
    await logEvent(null, "masking_rule_removed", {
      table: rule.tableName,
      column: rule.columnName,
    });
  }
  return NextResponse.json({ ok: true });
}
