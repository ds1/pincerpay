import { Hono } from "hono";

interface HealthOptions {
  /** Kora fee payer address (set when Kora is configured) */
  koraFeePayer?: string;
}

export function createHealthRoute(options?: HealthOptions) {
  const app = new Hono();

  app.get("/health", (c) => {
    const response: Record<string, unknown> = {
      status: "ok",
      service: "pincerpay-facilitator",
      timestamp: new Date().toISOString(),
    };

    if (options?.koraFeePayer) {
      response.kora = {
        status: "configured",
        feePayer: options.koraFeePayer,
      };
    }

    return c.json(response);
  });

  return app;
}

/** Legacy export for backwards compatibility */
export const health = createHealthRoute();
