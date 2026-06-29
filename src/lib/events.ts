import { db } from "@/db";
import { events } from "@/db/schema";

export async function logEvent(
  branchId: string | null,
  type: string,
  payload: Record<string, unknown> = {},
) {
  await db.insert(events).values({ branchId, type, payload });
}
