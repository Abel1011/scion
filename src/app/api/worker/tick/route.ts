import { NextResponse } from "next/server";
import {
  closeOrphanedDeployRequests,
  processDue,
  sweepErroredBranches,
  sweepExpiredLeases,
} from "@/lib/jobs/runner";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// Worker + sweeper. Drives the provisioning state machine, reaps expired leases,
// reclaims errored clones and closes deploy requests orphaned by pruned
// branches. Wire to a Vercel Cron in production.
async function run() {
  const swept = await sweepExpiredLeases();
  const cleaned = await sweepErroredBranches();
  const closed = await closeOrphanedDeployRequests();
  const processed = await processDue(10);
  return NextResponse.json({ swept, cleaned, closed, processed });
}

export async function GET() {
  return run();
}

export async function POST() {
  return run();
}
