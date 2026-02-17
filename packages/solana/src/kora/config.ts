import { z } from "zod";

export const koraConfigSchema = z.object({
  /** Kora RPC endpoint URL */
  rpcUrl: z.string().url(),
  /** Kora API key for authentication (optional, depends on Kora node config) */
  apiKey: z.string().optional(),
});

export type KoraConfig = z.infer<typeof koraConfigSchema>;

/**
 * Parse Kora configuration from environment variables.
 * Returns null if KORA_RPC_URL is not set.
 */
export function parseKoraConfig(env: Record<string, string | undefined>): KoraConfig | null {
  if (!env.KORA_RPC_URL) return null;
  return koraConfigSchema.parse({
    rpcUrl: env.KORA_RPC_URL,
    apiKey: env.KORA_API_KEY,
  });
}
