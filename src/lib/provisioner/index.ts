import { getConfig } from "@/lib/config";
import { MockProvisioner } from "./mock";
import { AwsProvisioner } from "./aws";
import type { Provisioner } from "./types";

export type { Provisioner, StartCloneResult, CloneStatus } from "./types";

export async function getProvisioner(): Promise<Provisioner> {
  const config = await getConfig();
  return config.provisioner === "aws"
    ? new AwsProvisioner(config)
    : new MockProvisioner();
}
