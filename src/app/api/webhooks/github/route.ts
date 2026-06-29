import { NextResponse, after } from "next/server";
import crypto from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { getConfig } from "@/lib/config";
import { claimGoldenSlot } from "@/lib/lineage";
import { enqueue, processDue } from "@/lib/jobs/runner";
import { logEvent } from "@/lib/events";
import { getDemoProject } from "@/lib/queries";

export const runtime = "nodejs";

type GithubPr = {
  number: number;
  title?: string;
  head?: { ref?: string };
};

/** Constant-time check of GitHub's HMAC-SHA256 webhook signature. */
function verifySignature(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const event = req.headers.get("x-github-event");
  const raw = await req.text();

  // Reject forged payloads when a webhook secret is configured.
  const config = await getConfig();
  if (config.githubWebhookSecret) {
    const ok = verifySignature(
      raw,
      req.headers.get("x-hub-signature-256"),
      config.githubWebhookSecret,
    );
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: { action?: string; pull_request?: GithubPr };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event !== "pull_request" || !body.pull_request) {
    return NextResponse.json({ ignored: true });
  }

  const project = await getDemoProject();
  if (!project) return NextResponse.json({ ignored: true });

  // Automatic provisioning is opt-in (off by default). Manage branches
  // manually from the dashboard unless explicitly enabled.
  if (!config.autoProvision) {
    return NextResponse.json({ ignored: true, reason: "auto-provision disabled" });
  }

  const pr = body.pull_request;
  const gitBranch = pr.head?.ref ?? `pr-${pr.number}`;
  const open = ["opened", "reopened", "synchronize"];

  if (body.action && open.includes(body.action)) {
    const existing = await db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.projectId, project.id),
          eq(branches.gitBranch, gitBranch),
          ne(branches.status, "deleted"),
        ),
      );
    if (existing.length) {
      return NextResponse.json({ ok: true, branchId: existing[0].id });
    }

    const golden = await claimGoldenSlot(project.id);
    if (!golden) {
      return NextResponse.json({ error: "capacity" }, { status: 503 });
    }
    const [branch] = await db
      .insert(branches)
      .values({
        projectId: project.id,
        goldenId: golden.id,
        prNumber: pr.number,
        gitBranch,
        title: pr.title ?? gitBranch,
        status: "provisioning",
        source: "github",
      })
      .returning();
    await logEvent(branch.id, "created", { source: "github" });
    await enqueue("provision", branch.id);
    after(async () => {
      await processDue(3);
    });
    return NextResponse.json({ ok: true, branchId: branch.id });
  }

  if (body.action === "closed") {
    const rows = await db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.projectId, project.id),
          eq(branches.gitBranch, gitBranch),
          ne(branches.status, "deleted"),
        ),
      );
    for (const b of rows) await enqueue("teardown", b.id);
    after(async () => {
      await processDue(3);
    });
    return NextResponse.json({ ok: true, tornDown: rows.length });
  }

  return NextResponse.json({ ignored: true });
}
