import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { Database } from "@pincerpay/db";
import { transactions, agents } from "@pincerpay/db";
import type { AppEnv } from "../env.js";
import { paymentRequestSchema } from "./schemas.js";

interface SettleRouteOptions {
  /** Whether Kora gasless mode is active for Solana transactions */
  koraEnabled?: boolean;
}

export function createSettleRoute(
  facilitator: x402Facilitator,
  db: Database,
  options?: SettleRouteOptions,
) {
  const app = new Hono<AppEnv>();

  app.post("/v1/settle", async (c) => {
    const logger = c.get("logger");
    const requestId = c.get("requestId");
    const merchantId = c.get("merchantId");

    try {
      const body = await c.req.json();
      const parsed = paymentRequestSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          { error: "Invalid request body", details: parsed.error.issues },
          400,
        );
      }

      // Use the original body for x402 (preserves full types), Zod just validates structure
      const { paymentPayload, paymentRequirements } = body;

      logger.info({
        msg: "settle_request",
        requestId,
        network: paymentRequirements.network,
        scheme: paymentRequirements.scheme,
        amount: paymentRequirements.amount,
        payTo: paymentRequirements.payTo,
      });

      const result = await facilitator.settle(
        paymentPayload,
        paymentRequirements,
      );

      // Record transaction in database
      if (result.success && merchantId) {
        const amount = String(paymentRequirements.amount);
        const isOptimistic =
          BigInt(amount) < BigInt(1_000_000); // < 1 USDC

        const txStatus = isOptimistic ? "optimistic" : "confirmed";

        // Determine gas token from chain namespace
        // When Kora is active, Solana gas is paid in USDC instead of SOL
        const network = String(result.network);
        const gasToken = network.startsWith("solana:")
          ? (options?.koraEnabled ? "USDC" : "SOL")
          : network.startsWith("eip155:137") || network.startsWith("eip155:80002") ? "MATIC"
          : "ETH";

        // Upsert agent: auto-register unknown agents on first payment
        const fromAddress = result.payer ?? "unknown";
        const agentUpsert = fromAddress !== "unknown"
          ? db.select({ id: agents.id })
              .from(agents)
              .where(and(eq(agents.solanaAddress, fromAddress), eq(agents.merchantId, merchantId)))
              .limit(1)
              .then(async (rows) => {
                if (rows[0]) return rows[0].id;
                // Auto-register: create agent with abbreviated address as name
                const abbrev = fromAddress.slice(0, 4) + "..." + fromAddress.slice(-4);
                const [inserted] = await db.insert(agents).values({
                  merchantId,
                  name: `Agent ${abbrev}`,
                  solanaAddress: fromAddress,
                  status: "active",
                }).returning({ id: agents.id });
                return inserted.id;
              })
              .catch(() => null)
          : Promise.resolve(null);

        agentUpsert.then((agentId) => {
          return db.insert(transactions)
            .values({
              merchantId,
              chainId: result.network,
              txHash: result.transaction,
              fromAddress,
              toAddress: paymentRequirements.payTo,
              amount,
              gasToken,
              status: txStatus,
              optimistic: isOptimistic,
              agentId,
              endpoint: paymentPayload.resource?.url,
            });
        })
          .then(() => {
            logger.info({
              msg: "transaction_recorded",
              requestId,
              txHash: result.transaction,
            });

            // Dispatch webhook if merchant has one configured
            const webhookUrl = c.get("webhookUrl");
            if (webhookUrl) {
              globalThis.fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "transaction.settled",
                  transaction: {
                    txHash: result.transaction,
                    chainId: result.network,
                    amount,
                    fromAddress: result.payer ?? "unknown",
                    toAddress: paymentRequirements.payTo,
                    status: txStatus,
                    endpoint: paymentPayload.resource?.url,
                  },
                }),
              }).catch((err: unknown) => {
                logger.error({
                  msg: "webhook_dispatch_failed",
                  requestId,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
            }
          })
          .catch((err: unknown) => {
            logger.error({
              msg: "transaction_record_failed",
              requestId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }

      logger.info({
        msg: "settle_result",
        requestId,
        success: result.success,
        txHash: result.transaction,
        network: result.network,
      });

      return c.json(result);
    } catch (error) {
      logger.error({
        msg: "settle_error",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          errorReason: "INTERNAL_ERROR",
          errorMessage: "Settlement failed due to an internal error",
          transaction: "",
          network: "",
        },
        500,
      );
    }
  });

  return app;
}
