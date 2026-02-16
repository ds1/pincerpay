import { Hono } from "hono";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { AppEnv } from "../env.js";

export function createVerifyRoute(facilitator: x402Facilitator) {
  const app = new Hono<AppEnv>();

  app.post("/v1/verify", async (c) => {
    const logger = c.get("logger");
    const requestId = c.get("requestId");

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
        msg: "verify_request",
        requestId,
        network: paymentRequirements.network,
        scheme: paymentRequirements.scheme,
        amount: paymentRequirements.amount,
      });

      const result = await facilitator.verify(
        paymentPayload,
        paymentRequirements,
      );

      logger.info({
        msg: "verify_result",
        requestId,
        isValid: result.isValid,
        payer: result.payer,
      });

      return c.json(result);
    } catch (error) {
      logger.error({
        msg: "verify_error",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          isValid: false,
          invalidReason: "INTERNAL_ERROR",
          invalidMessage: "Verification failed due to an internal error",
        },
        500,
      );
    }
  });

  return app;
}
