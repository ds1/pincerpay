import { Hono } from "hono";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { Database } from "@pincerpay/db";
import { transactions } from "@pincerpay/db";
import type { AppEnv } from "../env.js";
import { paymentRequestSchema } from "./schemas.js";

export function createSettleRoute(
  facilitator: x402Facilitator,
  db: Database,
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
        const network = String(result.network);
        const gasToken = network.startsWith("solana:") ? "SOL"
          : network.startsWith("eip155:137") || network.startsWith("eip155:80002") ? "MATIC"
          : "ETH";

        db.insert(transactions)
          .values({
            merchantId,
            chainId: result.network,
            txHash: result.transaction,
            fromAddress: result.payer ?? "unknown",
            toAddress: paymentRequirements.payTo,
            amount,
            gasToken,
            status: txStatus,
            optimistic: isOptimistic,
            endpoint: paymentPayload.resource?.url,
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
