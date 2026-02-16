import { Hono } from "hono";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { Database } from "@pincerpay/db";
import { transactions } from "@pincerpay/db";
import type { AppEnv } from "../env.js";

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
      const { paymentPayload, paymentRequirements } = body;

      if (!paymentPayload || !paymentRequirements) {
        return c.json(
          { error: "Missing paymentPayload or paymentRequirements" },
          400,
        );
      }

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
        const amount = paymentRequirements.amount as string;
        const isOptimistic =
          BigInt(amount) < BigInt(1_000_000); // < 1 USDC

        db.insert(transactions)
          .values({
            merchantId,
            chainId: result.network,
            txHash: result.transaction,
            fromAddress: result.payer ?? "unknown",
            toAddress: paymentRequirements.payTo,
            amount,
            status: isOptimistic ? "optimistic" : "confirmed",
            optimistic: isOptimistic,
            endpoint: paymentPayload.resource?.url,
          })
          .then(() => {
            logger.info({
              msg: "transaction_recorded",
              requestId,
              txHash: result.transaction,
            });
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
