import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Database } from "@pincerpay/db";
import { transactions, merchants, agents } from "@pincerpay/db";
import type { PincerPayProgram } from "@pincerpay/program";
import type { AppEnv } from "../env.js";

const settleDirectSchema = z.object({
  /** Agent's Solana wallet address */
  agentAddress: z.string().min(1),
  /** Merchant UUID */
  merchantId: z.string().uuid(),
  /** USDC amount in base units (e.g., "1000000" = 1 USDC) */
  amount: z.string().regex(/^\d+$/),
  /** CAIP-2 network ID */
  network: z.string().default("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
});

interface SettleDirectRouteOptions {
  program: PincerPayProgram;
  koraEnabled?: boolean;
}

/**
 * POST /v1/settle-direct
 *
 * Direct on-chain settlement via the Anchor program.
 * Unlike /v1/settle (x402 flow), this route builds the Anchor settle_payment
 * instruction directly. The agent and facilitator authority co-sign.
 *
 * Note: In the current implementation, this prepares the settlement parameters
 * and records the transaction. The actual on-chain settlement instruction
 * execution requires the agent to sign the transaction client-side.
 */
export function createSettleDirectRoute(
  db: Database,
  options: SettleDirectRouteOptions,
) {
  const { program, koraEnabled } = options;
  const app = new Hono<AppEnv>();

  app.post("/v1/settle-direct", async (c) => {
    const logger = c.get("logger");
    const requestId = c.get("requestId");
    const merchantId = c.get("merchantId");

    try {
      const body = await c.req.json();
      const parsed = settleDirectSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          { error: "Invalid request body", details: parsed.error.issues },
          400,
        );
      }

      const { agentAddress, amount, network } = parsed.data;

      // Verify this is a Solana network
      if (!network.startsWith("solana:")) {
        return c.json(
          { error: "Direct settlement only supports Solana networks" },
          400,
        );
      }

      // Verify merchant exists and is registered on-chain
      const merchant = merchantId
        ? await db
            .select({ merchantPda: merchants.merchantPda, onChainRegistered: merchants.onChainRegistered, walletAddress: merchants.walletAddress })
            .from(merchants)
            .where(eq(merchants.id, merchantId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : null;

      if (!merchant) {
        return c.json({ error: "Merchant not found" }, 404);
      }

      if (!merchant.onChainRegistered || !merchant.merchantPda) {
        return c.json(
          { error: "Merchant is not registered on-chain. Use /v1/settle for x402 settlement." },
          400,
        );
      }

      // Get the settlement accounts from the program client
      // The actual nonce would come from reading the on-chain config,
      // but for now we derive the accounts needed for the instruction
      const merchantPda = await program.getMerchantPda(parsed.data.merchantId);
      const configPda = await program.getConfigPda();

      logger.info({
        msg: "settle_direct_request",
        requestId,
        agentAddress,
        merchantId: parsed.data.merchantId,
        amount,
        network,
        configPda,
        merchantPda,
      });

      // Record the intent in the database
      // The actual on-chain execution happens when the agent submits the signed transaction
      const isOptimistic = BigInt(amount) < BigInt(1_000_000); // < 1 USDC
      const txStatus = isOptimistic ? "optimistic" : "pending";
      const gasToken = koraEnabled ? "USDC" : "SOL";

      // Upsert agent: auto-register unknown agents on first payment
      let agentId: string | null = null;
      try {
        const existing = await db
          .select({ id: agents.id })
          .from(agents)
          .where(and(eq(agents.solanaAddress, agentAddress), eq(agents.merchantId, merchantId!)))
          .limit(1);
        if (existing[0]) {
          agentId = existing[0].id;
        } else {
          const abbrev = agentAddress.slice(0, 4) + "..." + agentAddress.slice(-4);
          const [inserted] = await db.insert(agents).values({
            merchantId: merchantId!,
            name: `Agent ${abbrev}`,
            solanaAddress: agentAddress,
            status: "active",
          }).returning({ id: agents.id });
          agentId = inserted.id;
        }
      } catch {
        agentId = null;
      }

      const [inserted] = await db.insert(transactions)
        .values({
          merchantId: merchantId!,
          chainId: network,
          txHash: `pending-direct-${Date.now()}`, // Placeholder until on-chain tx is broadcast
          fromAddress: agentAddress,
          toAddress: merchant.walletAddress,
          amount,
          gasToken,
          status: txStatus,
          optimistic: isOptimistic,
          settlementType: "direct",
          agentId,
        })
        .returning({ id: transactions.id });

      return c.json({
        success: true,
        transactionId: inserted.id,
        settlementType: "direct",
        accounts: {
          config: configPda,
          merchantAccount: merchantPda,
          merchantUsdcAta: merchant.walletAddress,
          agent: agentAddress,
        },
        amount,
        network,
      });
    } catch (error) {
      logger.error({
        msg: "settle_direct_error",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          errorReason: "INTERNAL_ERROR",
          errorMessage: "Direct settlement failed due to an internal error",
        },
        500,
      );
    }
  });

  return app;
}
