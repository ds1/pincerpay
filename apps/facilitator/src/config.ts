import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4402),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),

  /** Facilitator wallet private key (Solana) — base58-encoded 64-byte keypair. Optional if KORA_RPC_URL is set. */
  SOLANA_PRIVATE_KEY: z.string().min(1).optional(),

  /** Facilitator wallet private key (EVM) — optional, for EVM chain support */
  FACILITATOR_PRIVATE_KEY: z.string().startsWith("0x").optional(),

  /** Comma-separated list of Solana networks (CAIP-2) to support */
  SOLANA_NETWORKS: z.string().default("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),

  /** Comma-separated list of EVM networks (CAIP-2) to support — optional */
  EVM_NETWORKS: z.string().optional(),

  /** RPC URLs (JSON: { "eip155:84532": "https://..." }) */
  RPC_URLS: z.string().optional(),

  /** Kora signer node RPC URL — enables gasless Solana transactions (agents pay USDC for gas) */
  KORA_RPC_URL: z.string().url().optional(),

  /** Kora API key for authentication (optional, depends on Kora node config) */
  KORA_API_KEY: z.string().optional(),

  /** Anchor program ID — enables on-chain settlement recording and direct settlement */
  ANCHOR_PROGRAM_ID: z.string().optional(),

  /** Comma-separated allowed CORS origins (e.g., "https://dashboard.pincerpay.com,https://api.merchant.com") */
  CORS_ORIGINS: z.string().optional(),

  /** Rate limiting */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(120),

  /** Log level */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Better Stack (Logtail) source token — enables log aggregation when set */
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),

  /** Graceful shutdown timeout in milliseconds */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(10_000),

  /** Enable OFAC compliance screening on settlement routes */
  OFAC_ENABLED: z.coerce.boolean().default(false),
  /** OFAC SDN list refresh interval in milliseconds (default: 24 hours) */
  OFAC_REFRESH_INTERVAL_MS: z.coerce.number().default(86_400_000),

  /** HMAC pepper for CLI bearer tokens. At least 32 chars. Generate with `openssl rand -base64 48`. */
  TOKEN_PEPPER: z.string().min(32).optional(),
  /** Supabase project URL (e.g. https://xxxx.supabase.co). Required for CLI onboarding. */
  SUPABASE_URL: z.string().url().optional(),
  /** Supabase publishable / anon key. Required for CLI onboarding. */
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
}).refine(
  (data) => data.SOLANA_PRIVATE_KEY || data.KORA_RPC_URL,
  { message: "At least one of SOLANA_PRIVATE_KEY or KORA_RPC_URL is required", path: ["SOLANA_PRIVATE_KEY"] },
);

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
