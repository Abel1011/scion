import { z } from "zod";

const schema = z.object({
  METADATA_DATABASE_URL: z
    .string()
    .default("postgres://localhost:5432/scion"),
  PROVISIONER: z.enum(["mock", "aws"]).default("mock"),

  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  GOLDEN_HOST: z.string().optional(),
  GOLDEN_DB_NAME: z.string().default("shop"),
  GOLDEN_MASTER_USER: z.string().optional(),
  GOLDEN_MASTER_PASSWORD: z.string().optional(),
  DB_SUBNET_GROUP_NAME: z.string().optional(),
  DB_SECURITY_GROUP_ID: z.string().optional(),

  VERCEL_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  DEMO_MAX_BRANCHES: z.coerce.number().default(6),
  DEMO_TTL_MINUTES: z.coerce.number().default(120),
  LINEAGE_LIMIT: z.coerce.number().default(15),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
