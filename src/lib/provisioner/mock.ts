import type {
  CloneInput,
  CloneStatus,
  Provisioner,
  StartCloneResult,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulated provisioner: runs the full flow without AWS, with realistic delays. */
export class MockProvisioner implements Provisioner {
  readonly kind = "mock" as const;

  async startClone({ branchId, label }: CloneInput): Promise<StartCloneResult> {
    await sleep(300);
    const suffix = branchId.replace(/-/g, "").slice(0, 8);
    const clusterId = `scion-${label}-${suffix}`;
    return { clusterId, instanceId: `${clusterId}-i1` };
  }

  // The mock instance is "available" immediately, so a provision completes in
  // a single worker tick.
  async getCloneStatus({
    clusterId,
  }: {
    clusterId: string;
    instanceId: string;
  }): Promise<CloneStatus> {
    return { ready: true, host: `${clusterId}.scion-db.aws` };
  }

  async runSql({
    statements,
  }: {
    host: string;
    statements: string[];
    ignoreErrors?: boolean;
  }): Promise<void> {
    await sleep(300 + Math.min(statements.length, 6) * 150);
  }

  async teardown(): Promise<void> {
    await sleep(400);
  }
}
