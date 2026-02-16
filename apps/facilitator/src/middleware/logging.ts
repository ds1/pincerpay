import { type MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";
import pino from "pino";

export function createLogger(level: string) {
  return pino({
    level,
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;

export function loggingMiddleware(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now();
    const requestId = crypto.randomUUID().slice(0, 8);

    c.set("requestId", requestId);
    c.set("logger", logger);

    logger.info({
      msg: "request",
      method: c.req.method,
      path: c.req.path,
      requestId,
    });

    await next();

    const duration = Math.round(performance.now() - start);
    logger.info({
      msg: "response",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      requestId,
    });
  };
}
