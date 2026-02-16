import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4402),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),

  /** Facilitator wallet private key (EVM) — used to broadcast txns */
  FACILITATOR_PRIVATE_KEY: z.string().startsWith("0x"),

  /** Comma-separated list of EVM networks (CAIP-2) to support */
  EVM_NETWORKS: z.string().default("eip155:84532"),

  /** RPC URLs (JSON: { "eip155:84532": "https://..." }) */
  RPC_URLS: z.string().optional(),

  /** Rate limiting */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(120),

  /** Log level */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}

export function parseRpcUrls(rpcUrlsJson?: string): Record<string, string> {
  if (!rpcUrlsJson) return {};
  try {
    return JSON.parse(rpcUrlsJson) as Record<string, string>;
  } catch {
    return {};
  }
}
