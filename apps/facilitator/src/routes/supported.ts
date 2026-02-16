import { Hono } from "hono";
import type { x402Facilitator } from "@x402/core/facilitator";

export function createSupportedRoute(facilitator: x402Facilitator) {
  const app = new Hono();

  app.get("/v1/supported", (c) => {
    const supported = facilitator.getSupported();
    return c.json(supported);
  });

  return app;
}
