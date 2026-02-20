import { eq, and, lt } from "drizzle-orm";
import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { base, baseSepolia, polygon, polygonAmoy } from "viem/chains";
import { createSolanaRpc, signature } from "@solana/kit";
import type { Database } from "@pincerpay/db";
import { transactions } from "@pincerpay/db";
import { CHAINS_BY_CAIP2 } from "@pincerpay/core/chains";
import type { Logger } from "../middleware/logging.js";
import { dispatchWebhook, getWebhookUrl } from "../webhooks/dispatcher.js";

/** Map CAIP-2 network IDs to viem chain definitions */
const EVM_CHAIN_MAP: Record<string, Chain> = {
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
  "eip155:137": polygon,
  "eip155:80002": polygonAmoy,
};

/** Transaction row type from Drizzle select */
type TransactionRow = typeof transactions.$inferSelect;

export interface WorkerStatus {
  running: boolean;
  lastCycleAt: string | null;
  cycleCount: number;
  consecutiveErrors: number;
  lastError: string | null;
}

interface ConfirmationWorkerOptions {
  intervalMs?: number;
  maxIntervalMs?: number;
  maxAge?: number;
  batchSize?: number;
  rpcUrls: Record<string, string>;
  logger: Logger;
  /** Whether Kora gasless mode is active — sets gasToken to USDC for Solana txns */
  koraEnabled?: boolean;
}

/**
 * Background worker that polls chains for "optimistic" transaction receipts
 * and updates their status to "confirmed" or "failed".
 *
 * Supports both EVM (viem getTransactionReceipt) and Solana (getSignatureStatuses).
 *
 * Uses adaptive polling: starts at `intervalMs`, backs off to `maxIntervalMs`
 * when idle, resets to `intervalMs` when work is found. Call `nudge()` to
 * reset the interval immediately (e.g. after a new settlement).
 */
export function startConfirmationWorker(
  db: Database,
  options: ConfirmationWorkerOptions,
) {
  const {
    intervalMs = 60_000,
    maxIntervalMs = 300_000,
    maxAge = 30_000,
    batchSize = 50,
    rpcUrls,
    logger,
    koraEnabled,
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

  // Cache Solana RPC connections
  const solanaRpcCache = new Map<string, ReturnType<typeof createSolanaRpc>>();

  function getSolanaRpc(chainId: string) {
    let rpc = solanaRpcCache.get(chainId);
    if (!rpc) {
      const chainConfig = CHAINS_BY_CAIP2[chainId];
      const rpcUrl = rpcUrls[chainId] ?? chainConfig?.rpcUrl ?? "https://api.devnet.solana.com";
      rpc = createSolanaRpc(rpcUrl);
      solanaRpcCache.set(chainId, rpc);
    }
    return rpc;
  }

  // Cache EVM public clients
  const evmClientCache = new Map<string, PublicClient>();

  function getEvmClient(chainId: string): PublicClient | null {
    let client = evmClientCache.get(chainId);
    if (!client) {
      const chain = EVM_CHAIN_MAP[chainId];
      if (!chain) return null;
      client = createPublicClient({
        chain,
        transport: http(rpcUrls[chainId] ?? undefined),
      });
      evmClientCache.set(chainId, client);
    }
    return client;
  }

  async function confirmEvmTransaction(tx: TransactionRow): Promise<void> {
    const client = getEvmClient(tx.chainId);
    if (!client) {
      logger.warn({ msg: "confirmation_unknown_evm_chain", chainId: tx.chainId, txHash: tx.txHash });
      return;
    }

    const receipt = await client.getTransactionReceipt({
      hash: tx.txHash as `0x${string}`,
    });

    if (receipt) {
      const newStatus = receipt.status === "success" ? "confirmed" : "failed";
      const gasCostWei = String(receipt.gasUsed * receipt.effectiveGasPrice);
      const chainConfig = CHAINS_BY_CAIP2[tx.chainId];
      // Determine gas token from chain namespace
      const gasToken = chainConfig?.chainId === 137 || chainConfig?.chainId === 80002
        ? "MATIC"
        : "ETH";

      await db
        .update(transactions)
        .set({
          status: newStatus,
          confirmedAt: new Date(),
          gasCost: gasCostWei,
          gasToken,
        })
        .where(eq(transactions.id, tx.id));

      logger.info({
        msg: "tx_confirmed",
        txHash: tx.txHash,
        chain: "evm",
        status: newStatus,
        gasCostWei,
        gasToken,
      });

      // Dispatch webhook for status transition
      await dispatchConfirmationWebhook(db, tx, newStatus, logger);
    }
  }

  async function confirmSolanaTransactionsBatch(txns: TransactionRow[]): Promise<void> {
    // Group by chainId so we can batch per RPC endpoint
    const byChain = new Map<string, TransactionRow[]>();
    for (const tx of txns) {
      const group = byChain.get(tx.chainId) ?? [];
      group.push(tx);
      byChain.set(tx.chainId, group);
    }

    for (const [chainId, chainTxns] of byChain) {
      const rpc = getSolanaRpc(chainId);
      const sigs = chainTxns.map((tx) => signature(tx.txHash));

      // Single batched RPC call for all signatures on this chain
      const statuses = await rpc
        .getSignatureStatuses(sigs, { searchTransactionHistory: true })
        .send();

      for (let i = 0; i < chainTxns.length; i++) {
        const tx = chainTxns[i];
        const txStatus = statuses.value[i];

        if (!txStatus) {
          // Transaction not found yet — will retry next cycle
          continue;
        }

        try {
          if (txStatus.err) {
            // Transaction failed on-chain
            await db
              .update(transactions)
              .set({
                status: "failed",
                confirmedAt: new Date(),
                gasToken: koraEnabled ? "USDC" : "SOL",
                slot: String(txStatus.slot),
              })
              .where(eq(transactions.id, tx.id));

            logger.info({
              msg: "tx_confirmed",
              txHash: tx.txHash,
              chain: "solana",
              status: "failed",
              slot: String(txStatus.slot),
            });

            await dispatchConfirmationWebhook(db, tx, "failed", logger);
            continue;
          }

          const confirmationStatus = txStatus.confirmationStatus;

          if (confirmationStatus === "confirmed" || confirmationStatus === "finalized") {
            await db
              .update(transactions)
              .set({
                status: "confirmed",
                confirmedAt: new Date(),
                gasToken: koraEnabled ? "USDC" : "SOL",
                slot: String(txStatus.slot),
              })
              .where(eq(transactions.id, tx.id));

            logger.info({
              msg: "tx_confirmed",
              txHash: tx.txHash,
              chain: "solana",
              status: "confirmed",
              confirmationStatus,
              slot: String(txStatus.slot),
            });

            await dispatchConfirmationWebhook(db, tx, "confirmed", logger);
          } else {
            logger.debug({
              msg: "solana_tx_processed_not_confirmed",
              txHash: tx.txHash,
              confirmationStatus,
              slot: String(txStatus.slot),
            });
          }
        } catch (err) {
          logger.debug({
            msg: "confirmation_check_skipped",
            txHash: tx.txHash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  async function checkPendingTransactions() {
    if (running) return; // Skip if previous cycle is still running
    running = true;
    status.running = true;

    try {
      const cutoff = new Date(Date.now() - maxAge);

      const pending = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.status, "optimistic"),
            lt(transactions.createdAt, cutoff),
          ),
        )
        .limit(batchSize);

      if (pending.length === 0) {
        // No work — back off
        currentInterval = Math.min(currentInterval * 2, maxIntervalMs);
        scheduleNext();
        status.consecutiveErrors = 0;
        status.cycleCount++;
        status.lastCycleAt = new Date().toISOString();
        running = false;
        status.running = false;
        return;
      }

      // Work found — reset to base interval
      currentInterval = intervalMs;

      logger.debug({
        msg: "confirmation_worker_checking",
        count: pending.length,
      });

      // Split into EVM and Solana
      const evmTxns = pending.filter((tx) => tx.chainId.startsWith("eip155:"));
      const solanaTxns = pending.filter((tx) => tx.chainId.startsWith("solana:"));
      const unknownTxns = pending.filter(
        (tx) => !tx.chainId.startsWith("eip155:") && !tx.chainId.startsWith("solana:"),
      );

      for (const tx of unknownTxns) {
        logger.warn({ msg: "confirmation_unknown_namespace", chainId: tx.chainId, txHash: tx.txHash });
      }

      // EVM: still per-transaction (getTransactionReceipt doesn't support batching)
      for (const tx of evmTxns) {
        try {
          await confirmEvmTransaction(tx);
        } catch (err) {
          logger.debug({
            msg: "confirmation_check_skipped",
            txHash: tx.txHash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Solana: batched getSignatureStatuses
      if (solanaTxns.length > 0) {
        try {
          await confirmSolanaTransactionsBatch(solanaTxns);
        } catch (err) {
          logger.debug({
            msg: "solana_batch_confirmation_error",
            count: solanaTxns.length,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      status.consecutiveErrors = 0;
      status.cycleCount++;
      status.lastCycleAt = new Date().toISOString();
    } catch (err) {
      status.consecutiveErrors++;
      status.lastError = err instanceof Error ? err.message : String(err);
      logger.error({
        msg: "confirmation_worker_error",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      scheduleNext();
      running = false;
      status.running = false;
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
    currentCycle = checkPendingTransactions().finally(() => {
      currentCycle = null;
    });
  }

  // Start first cycle
  scheduleNext();

  logger.info({
    msg: "confirmation_worker_started",
    intervalMs,
    maxIntervalMs,
    maxAge,
    batchSize,
    chains: ["evm", "solana"],
  });

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (currentCycle) {
        logger.info({ msg: "confirmation_worker_draining" });
        await currentCycle;
      }
      logger.info({ msg: "confirmation_worker_stopped" });
    },
    getStatus: (): WorkerStatus => ({ ...status }),
    /** Reset polling interval to base rate — call after a new settlement. */
    nudge: () => {
      currentInterval = intervalMs;
      if (!running) {
        if (timer) clearTimeout(timer);
        scheduleNext();
      }
    },
  };
}

/** Dispatch a webhook when a transaction transitions to confirmed or failed. */
async function dispatchConfirmationWebhook(
  db: Database,
  tx: TransactionRow,
  newStatus: string,
  logger: Logger,
): Promise<void> {
  try {
    const webhookUrl = await getWebhookUrl(db, tx.merchantId);
    if (!webhookUrl) return;

    const event = newStatus === "confirmed" ? "payment.confirmed" : "payment.failed";

    await dispatchWebhook(db, {
      merchantId: tx.merchantId,
      transactionId: tx.id,
      webhookUrl,
      payload: {
        event,
        transaction: {
          txHash: tx.txHash,
          chainId: tx.chainId,
          amount: tx.amount,
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          status: newStatus,
          endpoint: tx.endpoint ?? undefined,
        },
      },
      logger,
    });
  } catch (err) {
    logger.error({
      msg: "confirmation_webhook_dispatch_error",
      txHash: tx.txHash,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
