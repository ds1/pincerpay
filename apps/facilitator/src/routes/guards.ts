import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { resolveChain } from "@pincerpay/core";
import type { Database } from "@pincerpay/db";
import { merchants } from "@pincerpay/db";
import type { AppEnv } from "../env.js";

/**
 * Test API keys cannot operate on mainnet chains. Returns a 403 response to
 * send, or null when the request may proceed.
 */
export function rejectTestKeyOnMainnet(
  c: Context<AppEnv>,
  network: unknown,
  logMsg: string,
): Response | null {
  if (c.get("environment") !== "test") return null;

  const chain = resolveChain(String(network));
  if (!chain || chain.testnet) return null;

  c.get("logger").warn({ msg: logMsg, requestId: c.get("requestId"), network });
  return c.json(
    {
      error: "test_key_chain_forbidden",
      message: `Test API keys cannot settle on ${chain.shorthand}. Use a testnet chain (e.g. solana-devnet) or a live key.`,
    },
    403,
  );
}

/**
 * Compare a requirement's payTo with a wallet address. EVM addresses compare
 * case-insensitively; Solana (base58) addresses compare exactly.
 */
export function sameWallet(network: string, a: string, b: string): boolean {
  return network.startsWith("eip155:") ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * The facilitator only settles payments to the calling merchant's own wallet.
 * Protects merchants whose integration forwards agent-supplied requirements
 * (SDK versions before @pincerpay/merchant 0.10.2, or hand-rolled clients).
 *
 * Merchants store one wallet today, so payments on a chain family other than
 * that wallet's are rejected until per-chain wallets exist.
 *
 * Returns a 403 response to send, or null when payTo is the merchant's wallet.
 */
export async function rejectForeignPayTo(
  c: Context<AppEnv>,
  db: Database,
  paymentRequirements: { network?: unknown; payTo?: unknown },
): Promise<Response | null> {
  const merchantId = c.get("merchantId");
  const network = String(paymentRequirements.network ?? "");
  const payTo = typeof paymentRequirements.payTo === "string" ? paymentRequirements.payTo : "";

  const [merchant] = merchantId
    ? await db
        .select({ walletAddress: merchants.walletAddress })
        .from(merchants)
        .where(eq(merchants.id, merchantId))
        .limit(1)
    : [];

  if (merchant && payTo && sameWallet(network, merchant.walletAddress, payTo)) {
    return null;
  }

  c.get("logger").warn({
    msg: "pay_to_not_merchant_wallet",
    requestId: c.get("requestId"),
    merchantId,
    network,
    payTo,
  });
  return c.json(
    {
      error: "pay_to_not_merchant_wallet",
      message: "paymentRequirements.payTo must be the merchant's registered wallet.",
    },
    403,
  );
}
