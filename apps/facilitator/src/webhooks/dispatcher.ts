import { eq, and, lte } from "drizzle-orm";
import type { Database } from "@pincerpay/db";
import { webhookDeliveries, merchants } from "@pincerpay/db";
import type { Logger } from "../middleware/logging.js";
import type { WorkerStatus } from "../workers/confirmation.js";

/** Retry delays in ms: 1s, 5s, 30s, 2min, 10min */
const RETRY_DELAYS = [1_000, 5_000, 30_000, 120_000, 600_000];

const MAX_ATTEMPTS = RETRY_DELAYS.length;

export interface WebhookPayload {
  event: string;
  transaction: {
    txHash: string;
    chainId: string;
    amount: string;
    fromAddress: string;
    toAddress: string;
    status: string;
    endpoint?: string;
  };
}

interface WebhookDispatcherOptions {
  /** Base polling interval in ms (default: 30000) */
  pollIntervalMs?: number;
  /** Maximum polling interval when idle (default: 300000 = 5 min) */
  maxPollIntervalMs?: number;
  logger: Logger;
}

/**
 * Dispatches a webhook with automatic retry and delivery tracking.
 * First attempt is immediate; failures are queued for background retry.
 */
export async function dispatchWebhook(
  db: Database,
  opts: {
    merchantId: string;
    transactionId?: string;
    webhookUrl: string;
    payload: WebhookPayload;
    logger: Logger;
  },
): Promise<void> {
  const { merchantId, transactionId, webhookUrl, payload, logger } = opts;
  const payloadJson = JSON.stringify(payload);

  // Insert delivery record
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      merchantId,
      transactionId,
      event: payload.event,
      url: webhookUrl,
      payload: payloadJson,
      status: "pending",
      maxAttempts: MAX_ATTEMPTS,
    })
    .returning({ id: webhookDeliveries.id });

  // Attempt immediate delivery
  await attemptDelivery(db, delivery.id, webhookUrl, payloadJson, 0, logger);
}

/**
 * Attempt to deliver a webhook. Updates the delivery record with results.
 */
async function attemptDelivery(
  db: Database,
  deliveryId: string,
  url: string,
  payload: string,
  attempt: number,
  logger: Logger,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await globalThis.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      // Success
      await db
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          statusCode: response.status,
          attempts: attempt + 1,
          deliveredAt: new Date(),
          nextRetryAt: null,
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      logger.info({ msg: "webhook_delivered", deliveryId, url, attempt: attempt + 1 });
    } else {
      // HTTP error — schedule retry
      await scheduleRetryOrFail(db, deliveryId, attempt, response.status, `HTTP ${response.status}`, logger);
    }
  } catch (err) {
    // Network error — schedule retry
    const errorMsg = err instanceof Error ? err.message : String(err);
    await scheduleRetryOrFail(db, deliveryId, attempt, null, errorMsg, logger);
  }
}

async function scheduleRetryOrFail(
  db: Database,
  deliveryId: string,
  attempt: number,
  statusCode: number | null,
  error: string,
  logger: Logger,
): Promise<void> {
  const nextAttempt = attempt + 1;

  if (nextAttempt >= MAX_ATTEMPTS) {
    // Max retries exhausted — mark as failed (dead letter)
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        statusCode,
        lastError: error,
        attempts: nextAttempt,
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    logger.error({ msg: "webhook_failed_permanent", deliveryId, attempts: nextAttempt, error });
  } else {
    // Schedule retry
    const delay = RETRY_DELAYS[nextAttempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
    const nextRetryAt = new Date(Date.now() + delay);

    await db
      .update(webhookDeliveries)
      .set({
        status: "retrying",
        statusCode,
        lastError: error,
        attempts: nextAttempt,
        nextRetryAt,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    logger.warn({
      msg: "webhook_retry_scheduled",
      deliveryId,
      attempt: nextAttempt,
      nextRetryAt: nextRetryAt.toISOString(),
      error,
    });
  }
}

/**
 * Background worker that retries failed webhook deliveries.
 * Polls the database for deliveries with status "retrying" and nextRetryAt <= now.
 *
 * Uses adaptive polling: backs off when idle, resets when work is found.
 */
export function startWebhookRetryWorker(
  db: Database,
  options: WebhookDispatcherOptions,
) {
  const {
    pollIntervalMs = 30_000,
    maxPollIntervalMs = 300_000,
    logger,
  } = options;

  let running = false;
  let currentInterval = pollIntervalMs;
  const status: WorkerStatus = {
    running: false,
    lastCycleAt: null,
    cycleCount: 0,
    consecutiveErrors: 0,
    lastError: null,
  };

  async function processRetries() {
    if (running) return;
    running = true;
    status.running = true;

    try {
      const now = new Date();

      const pending = await db
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.status, "retrying"),
            lte(webhookDeliveries.nextRetryAt, now),
          ),
        )
        .limit(20);

      if (pending.length === 0) {
        // No work — back off
        currentInterval = Math.min(currentInterval * 2, maxPollIntervalMs);
      } else {
        // Work found — reset to base interval
        currentInterval = pollIntervalMs;

        for (const delivery of pending) {
          await attemptDelivery(
            db,
            delivery.id,
            delivery.url,
            delivery.payload,
            delivery.attempts,
            logger,
          );
        }
      }

      status.consecutiveErrors = 0;
      status.cycleCount++;
      status.lastCycleAt = new Date().toISOString();
    } catch (err) {
      status.consecutiveErrors++;
      status.lastError = err instanceof Error ? err.message : String(err);
      logger.error({
        msg: "webhook_retry_worker_error",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
      status.running = false;
      scheduleNext();
    }
  }

  let currentCycle: Promise<void> | null = null;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleNext() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(wrappedCheck, currentInterval);
    timer.unref();
  }

  function wrappedCheck() {
    if (stopped) return;
    currentCycle = processRetries().finally(() => {
      currentCycle = null;
    });
  }

  // Start first cycle
  scheduleNext();

  logger.info({ msg: "webhook_retry_worker_started", pollIntervalMs, maxPollIntervalMs });

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (currentCycle) {
        logger.info({ msg: "webhook_retry_worker_draining" });
        await currentCycle;
      }
      logger.info({ msg: "webhook_retry_worker_stopped" });
    },
    getStatus: (): WorkerStatus => ({ ...status }),
    /** Reset polling interval to base rate — call when new retries are expected. */
    nudge: () => {
      currentInterval = pollIntervalMs;
      if (!running) {
        if (timer) clearTimeout(timer);
        scheduleNext();
      }
    },
  };
}

/**
 * Look up webhook URL for a merchant (used by confirmation worker).
 */
export async function getWebhookUrl(db: Database, merchantId: string): Promise<string | null> {
  const [row] = await db
    .select({ webhookUrl: merchants.webhookUrl })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  return row?.webhookUrl ?? null;
}
