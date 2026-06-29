import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  branches,
  deployRequests,
  events,
  goldens,
  jobs,
  maskingPolicies,
  maskingRules,
  projects,
} from "./schema";

async function main() {
  // Wipe demo state (child -> parent). NOTE: `connections` (BYOK config like the
  // Vercel token / selected project) is intentionally preserved.
  await db.delete(events);
  await db.delete(jobs);
  await db.delete(deployRequests);
  await db.delete(branches);
  await db.delete(maskingRules);
  await db.delete(maskingPolicies);
  await db.delete(goldens);
  await db.delete(projects);

  const [project] = await db
    .insert(projects)
    .values({
      name: "shop",
      githubRepo: "Abel1011/scion-shop",
    })
    .returning();

  const [policy] = await db
    .insert(maskingPolicies)
    .values({ projectId: project.id, name: "default" })
    .returning();

  await db.insert(maskingRules).values([
    { policyId: policy.id, tableName: "users", columnName: "email", fn: "mask_email" },
    { policyId: policy.id, tableName: "users", columnName: "name", fn: "mask_name" },
    { policyId: policy.id, tableName: "users", columnName: "card", fn: "mask_card" },
    {
      policyId: policy.id,
      tableName: "orders",
      columnName: "shipping_address",
      fn: "mask_address",
    },
  ]);

  await db
    .update(projects)
    .set({ maskingPolicyId: policy.id })
    .where(eq(projects.id, project.id));

  // One golden = the real production Aurora cluster Scion manages. Lineage
  // starts at 0; real branches increment it as they are created.
  await db.insert(goldens).values({
    projectId: project.id,
    auroraClusterId: "scion-golden",
    label: "shop-prod",
    lineageDepth: 0,
    status: "active",
  });

  // Real config events only, no fabricated branches or deploy requests.
  await db.insert(events).values([
    {
      branchId: null,
      type: "masking_rule_added",
      payload: { table: "users", column: "email", fn: "mask_email" },
    },
    {
      branchId: null,
      type: "masking_rule_added",
      payload: { table: "orders", column: "shipping_address", fn: "mask_address" },
    },
  ]);

  console.log(
    "Seeded: project, 1 golden (scion-golden), masking rules. No fake branches/deploy requests. Connections preserved.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
