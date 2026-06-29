import { NextResponse } from "next/server";
import { db } from "@/db";
import { maskingRules } from "@/db/schema";
import { getDemoProject, getOrCreatePolicyId, listMaskingRules } from "@/lib/queries";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTIONS = ["mask_email", "mask_name", "mask_card", "mask_phone", "nullify"];

export async function GET() {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ rules: [] });
  return NextResponse.json({ rules: await listMaskingRules(project.id) });
}

export async function POST(req: Request) {
  const project = await getDemoProject();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    tableName?: string;
    columnName?: string;
    fn?: string;
  };
  const tableName = body.tableName?.trim();
  const columnName = body.columnName?.trim();
  const fn = body.fn;

  if (!tableName || !columnName || !fn || !FUNCTIONS.includes(fn)) {
    return NextResponse.json({ error: "Invalid rule." }, { status: 400 });
  }

  const policyId = await getOrCreatePolicyId(project.id);
  const [rule] = await db
    .insert(maskingRules)
    .values({ policyId, tableName, columnName, fn })
    .returning();

  await logEvent(null, "masking_rule_added", {
    table: tableName,
    column: columnName,
    fn,
  });

  return NextResponse.json(
    {
      id: rule.id,
      tableName: rule.tableName,
      columnName: rule.columnName,
      fn: rule.fn,
      deterministic: rule.deterministic,
    },
    { status: 201 },
  );
}
