import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "@pincerpay/db";
import { transactions, merchants } from "@pincerpay/db";
import type { PincerPayProgram } from "@pincerpay/program";
import type { Logger } from "../middleware/logging.js";
import type { WorkerStatus } from "./confirmation.js";

interface OnChainRecorderOptions {
  intervalMs?: number;
  maxIntervalMs?: number;
  batchSize?: number;
  program: PincerPayProgram;
  logger: Logger;
}

/**
 * Background worker that records confirmed x402 Solana settlements on-chain
 * via the Anchor program's `record_x402_settlement` instruction.
 *
 * Queries confirmed Solana transactions WHERE:
 * - settlementType = "x402"
 * - programNonce IS NULL (not yet recorded on-chain)
 * - status = "confirmed"
 * - chain starts with "solana:"
 *
 * For each matching transaction, builds and submits a `record_x402_settlement`
 * instruction. On success, updates the transaction's `programNonce`.
 *
 * Failures are logged and retried on the next cycle — the x402 settlement
 * is already confirmed, so no data loss occurs.
 *
 * Uses adaptive polling: backs off when idle, resets when work is found.
 */
export function startOnChainRecorderWorker(
  db: Database,
  options: OnChainRecorderOptions,
) {
  const {
    intervalMs = 60_000,
    maxIntervalMs = 300_000,
    batchSize = 10,
    program,
    logger,
  } = options;

  let running = false;
  let currentInterval = intervalMs;
  const status: WorkerStatus = {
    running: false,
    lastCycleAt: null,
    cycleCount: 0,
    consecutiveErrors: 0,
    lastError: null,
  };

  async function recordPendingSettlements() {
    if (running) return;
    running = true;
    status.running = true;

    try {
      // Find confirmed Solana x402 settlements not yet recorded on-chain
      const pending = await db
        .select({
          id: transactions.id,
          merchantId: transactions.merchantId,
          txHash: transactions.txHash,
          fromAddress: transactions.fromAddress,
          amount: transactions.amount,
          chainId: transactions.chainId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.status, "confirmed"),
            eq(transactions.settlementType, "x402"),
            isNull(transactions.programNonce),
          ),
        )
        .limit(batchSize);

      // Filter to Solana-only transactions (can't do LIKE in all Drizzle versions easily)
      const solanaTxns = pending.filter((tx) => tx.chainId.startsWith("solana:"));

      if (solanaTxns.length === 0) {
        // No work — back off
        currentInterval = Math.min(currentInterval * 2, maxIntervalMs);
        status.consecutiveErrors = 0;
        status.cycleCount++;
        status.lastCycleAt = new Date().toISOString();
        running = false;
        status.running = false;
        scheduleNext();
        return;
      }

      // Work found — reset to base interval
      currentInterval = intervalMs;

      logger.debug({
        msg: "on_chain_recorder_checking",
        count: solanaTxns.length,
      });

      for (const tx of solanaTxns) {
        try {
          // Verify merchant is registered on-chain
          const merchant = await db
            .select({ onChainRegistered: merchants.onChainRegistered })
            .from(merchants)
            .where(eq(merchants.id, tx.merchantId))
            .limit(1)
            .then((rows) => rows[0]);

          if (!merchant?.onChainRegistered) {
            // Merchant not on-chain — skip, will be recorded once registered
            continue;
          }

          // Build the record_x402_settlement instruction parameters
          // In a full implementation, this would:
          // 1. Read current nonce from on-chain config
          // 2. Build the instruction
          // 3. Sign with facilitator authority
          // 4. Submit to Solana RPC
          // 5. Wait for confirmation
          //
          // For now, we derive the accounts and log the intent.
          // The actual submission requires the facilitator's signing key.
          const accounts = await program.getRecordX402SettlementAccounts(
            {
              merchantId: tx.merchantId,
              agentAddress: tx.fromAddress as Parameters<typeof program.getRecordX402SettlementAccounts>[0]["agentAddress"],
              amount: BigInt(tx.amount),
              x402TxHash: tx.txHash,
            },
            0n, // Placeholder nonce — real implementation reads from on-chain config
          );

          logger.info({
            msg: "on_chain_record_prepared",
            txId: tx.id,
            txHash: tx.txHash,
            merchantId: tx.merchantId,
            configPda: accounts.accounts.config,
            merchantPda: accounts.accounts.merchantAccount,
            settlementPda: accounts.accounts.settlementRecord,
          });

          // TODO: Once Anchor program is deployed, submit the instruction here:
          // const ix = program.buildRecordX402SettlementIx(accounts);
          // const sig = await signAndSend(ix, authority);
          // await db.update(transactions).set({ programNonce: nonce }).where(eq(transactions.id, tx.id));

        } catch (err) {
          logger.debug({
            msg: "on_chain_record_failed",
            txId: tx.id,
            txHash: tx.txHash,
            error: err instanceof Error ? err.message : String(err),
          });
          // Will retry next cycle
        }
      }
      status.consecutiveErrors = 0;
      status.cycleCount++;
      status.lastCycleAt = new Date().toISOString();
    } catch (err) {
      status.consecutiveErrors++;
      status.lastError = err instanceof Error ? err.message : String(err);
      logger.error({
        msg: "on_chain_recorder_error",
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
    currentCycle = recordPendingSettlements().finally(() => {
      currentCycle = null;
    });
  }

  // Start first cycle
  scheduleNext();

  logger.info({
    msg: "on_chain_recorder_started",
    intervalMs,
    maxIntervalMs,
    batchSize,
    programId: program.programId,
  });

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (currentCycle) {
        logger.info({ msg: "on_chain_recorder_draining" });
        await currentCycle;
      }
      logger.info({ msg: "on_chain_recorder_stopped" });
    },
    getStatus: (): WorkerStatus => ({ ...status }),
    /** Reset polling interval to base rate. */
    nudge: () => {
      currentInterval = intervalMs;
      if (!running) {
        if (timer) clearTimeout(timer);
        scheduleNext();
      }
    },
  };
}
