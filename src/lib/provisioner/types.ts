export interface StartCloneResult {
  clusterId: string;
  instanceId: string;
}

export interface CloneStatus {
  /** True once the new instance is available and reachable. */
  ready: boolean;
  /** Cluster endpoint, present once ready. */
  host?: string;
}

export interface CloneInput {
  branchId: string;
  goldenClusterId: string;
  label: string;
}

export interface Provisioner {
  readonly kind: "mock" | "aws";
  /**
   * Issues a copy-on-write clone of the golden + a fresh Serverless v2 instance
   * and returns immediately. It does NOT wait for the instance to come online.
   */
  startClone(input: CloneInput): Promise<StartCloneResult>;
  /** Polls whether the clone's instance is available yet (returns the host). */
  getCloneStatus(input: {
    clusterId: string;
    instanceId: string;
  }): Promise<CloneStatus>;
  /** Run statements (migrations / masking) against a clone. */
  runSql(input: {
    host: string;
    statements: string[];
    ignoreErrors?: boolean;
  }): Promise<void>;
  /** Delete the clone instance + cluster. */
  teardown(input: { clusterId: string; instanceId: string }): Promise<void>;
}
