import {
  RDSClient,
  RestoreDBClusterToPointInTimeCommand,
  CreateDBInstanceCommand,
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  DeleteDBInstanceCommand,
  DeleteDBClusterCommand,
} from "@aws-sdk/client-rds";
import postgres from "postgres";
import type { EffectiveConfig } from "@/lib/config";
import type {
  CloneInput,
  CloneStatus,
  Provisioner,
  StartCloneResult,
} from "./types";

/**
 * Real provisioner against Amazon Aurora. Uses native copy-on-write cloning.
 * Credentials and networking come from the effective config (DB or env).
 *
 * Cloning is split into a non-blocking start + a pollable status check so the
 * minutes-long "instance becoming available" wait never blocks a serverless
 * request. A worker tick advances the state machine instead.
 */
export class AwsProvisioner implements Provisioner {
  readonly kind = "aws" as const;
  private rds: RDSClient;

  constructor(private config: EffectiveConfig) {
    this.rds = new RDSClient({
      region: config.awsRegion,
      credentials:
        config.awsAccessKeyId && config.awsSecretAccessKey
          ? {
              accessKeyId: config.awsAccessKeyId,
              secretAccessKey: config.awsSecretAccessKey,
            }
          : undefined,
    });
  }

  async startClone({
    goldenClusterId,
    label,
  }: CloneInput): Promise<StartCloneResult> {
    const stamp = Date.now().toString(36);
    const clusterId = `scion-${label}-${stamp}`;
    const instanceId = `${clusterId}-i1`;

    await this.rds.send(
      new RestoreDBClusterToPointInTimeCommand({
        DBClusterIdentifier: clusterId,
        SourceDBClusterIdentifier: goldenClusterId,
        RestoreType: "copy-on-write",
        UseLatestRestorableTime: true,
        DBSubnetGroupName: this.config.dbSubnetGroupName,
        VpcSecurityGroupIds: this.config.dbSecurityGroupId
          ? [this.config.dbSecurityGroupId]
          : undefined,
        ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 2 },
      }),
    );

    await this.rds.send(
      new CreateDBInstanceCommand({
        DBInstanceIdentifier: instanceId,
        DBClusterIdentifier: clusterId,
        Engine: "aurora-postgresql",
        DBInstanceClass: "db.serverless",
        PubliclyAccessible: true,
      }),
    );

    return { clusterId, instanceId };
  }

  async getCloneStatus({
    clusterId,
    instanceId,
  }: {
    clusterId: string;
    instanceId: string;
  }): Promise<CloneStatus> {
    try {
      const inst = await this.rds.send(
        new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }),
      );
      if (inst.DBInstances?.[0]?.DBInstanceStatus !== "available") {
        return { ready: false };
      }
      const cluster = await this.rds.send(
        new DescribeDBClustersCommand({ DBClusterIdentifier: clusterId }),
      );
      const host = cluster.DBClusters?.[0]?.Endpoint;
      return host ? { ready: true, host } : { ready: false };
    } catch {
      // Instance not visible yet right after creation.
      return { ready: false };
    }
  }

  async runSql({
    host,
    statements,
    ignoreErrors,
  }: {
    host: string;
    statements: string[];
    ignoreErrors?: boolean;
  }): Promise<void> {
    const sql = postgres({
      host,
      port: 5432,
      database: this.config.goldenDbName,
      username: this.config.goldenMasterUser,
      password: this.config.goldenMasterPassword,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
    try {
      for (const stmt of statements) {
        if (ignoreErrors) {
          try {
            await sql.unsafe(stmt);
          } catch {
            /* skip rules for columns/tables removed by the migration */
          }
        } else {
          await sql.unsafe(stmt);
        }
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  async teardown({
    clusterId,
    instanceId,
  }: {
    clusterId: string;
    instanceId: string;
  }): Promise<void> {
    await this.rds
      .send(
        new DeleteDBInstanceCommand({
          DBInstanceIdentifier: instanceId,
          SkipFinalSnapshot: true,
        }),
      )
      .catch(() => undefined);

    await this.rds
      .send(
        new DeleteDBClusterCommand({
          DBClusterIdentifier: clusterId,
          SkipFinalSnapshot: true,
        }),
      )
      .catch(() => undefined);
  }
}
