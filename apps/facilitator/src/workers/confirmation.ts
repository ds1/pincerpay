import { eq, and, lt } from "drizzle-orm";
import { createPublicClient, http, type Chain } from "viem";
import { base, baseSepolia, polygon, polygonAmoy } from "viem/chains";
import { createSolanaRpc, signature } from "@solana/kit";
import type { Database } from "@pincerpay/db";
import { transactions } from "@pincerpay/db";
import { CHAINS_BY_CAIP2 } from "@pincerpay/core/chains";
import type { Logger } from "../middleware/logging.js";

/** Map CAIP-2 network IDs to viem chain definitions */
const EVM_CHAIN_MAP: Record<string, Chain> = {
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
  "eip155:137": polygon,
  "eip155:80002": polygonAmoy,
};

/** Transaction row type from Drizzle select */
type TransactionRow = typeof transactions.$inferSelect;

interface ConfirmationWorkerOptions {
  intervalMs?: number;
  maxAge?: number;
  batchSize?: number;
  rpcUrls: Record<string, string>;
  logger: Logger;
}

/**
 * Background worker that polls chains for "optimistic" transaction receipts
 * and updates their status to "confirmed" or "failed".
 *
 * Supports both EVM (viem getTransactionReceipt) and Solana (getSignatureStatuses).
 */
export function startConfirmationWorker(
  db: Database,
  options: ConfirmationWorkerOptions,
) {
  const {
    intervalMs = 15_000,
    maxAge = 30_000,
    batchSize = 50,
    rpcUrls,
    logger,
  } = options;

  let running = false;

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

  async function confirmEvmTransaction(tx: TransactionRow): Promise<void> {
    const chain = EVM_CHAIN_MAP[tx.chainId];
    if (!chain) {
      logger.warn({ msg: "confirmation_unknown_evm_chain", chainId: tx.chainId, txHash: tx.txHash });
      return;
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrls[tx.chainId] ?? undefined),
    });

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
    }
  }

  async function confirmSolanaTransaction(tx: TransactionRow): Promise<void> {
    const rpc = getSolanaRpc(tx.chainId);

    // Use branded Signature type required by @solana/kit v5
    const sig = signature(tx.txHash);

    // @solana/kit v5: rpc.method(...).send() pattern
    const statuses = await rpc
      .getSignatureStatuses([sig], { searchTransactionHistory: true })
      .send();

    const status = statuses.value[0];
    if (!status) {
      // Transaction not found yet — will retry next cycle
      return;
    }

    if (status.err) {
      // Transaction failed on-chain
      await db
        .update(transactions)
        .set({
          status: "failed",
          confirmedAt: new Date(),
          gasToken: "SOL",
          slot: String(status.slot),
        })
        .where(eq(transactions.id, tx.id));

      logger.info({
        msg: "tx_confirmed",
        txHash: tx.txHash,
        chain: "solana",
        status: "failed",
        slot: String(status.slot),
      });
      return;
    }

    // Determine confirmation level
    // confirmationStatus: "processed" | "confirmed" | "finalized"
    const confirmationStatus = status.confirmationStatus;

    // We consider "confirmed" (2/3 stake voted) as sufficient for standard txns
    // "finalized" (31 slots, ~6.4s) for high-value
    if (confirmationStatus === "confirmed" || confirmationStatus === "finalized") {
      await db
        .update(transactions)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          gasToken: "SOL",
          slot: String(status.slot),
        })
        .where(eq(transactions.id, tx.id));

      logger.info({
        msg: "tx_confirmed",
        txHash: tx.txHash,
        chain: "solana",
        status: "confirmed",
        confirmationStatus,
        slot: String(status.slot),
      });
    } else {
      // "processed" — not yet confirmed by supermajority, will retry
      logger.debug({
        msg: "solana_tx_processed_not_confirmed",
        txHash: tx.txHash,
        confirmationStatus,
        slot: String(status.slot),
      });
    }
  }

  async function checkPendingTransactions() {
    if (running) return; // Skip if previous cycle is still running
    running = true;

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
        running = false;
        return;
      }

      logger.debug({
        msg: "confirmation_worker_checking",
        count: pending.length,
      });

      for (const tx of pending) {
        try {
          if (tx.chainId.startsWith("eip155:")) {
            await confirmEvmTransaction(tx);
          } else if (tx.chainId.startsWith("solana:")) {
            await confirmSolanaTransaction(tx);
          } else {
            logger.warn({ msg: "confirmation_unknown_namespace", chainId: tx.chainId, txHash: tx.txHash });
          }
        } catch (err) {
          // Transaction not yet mined or RPC error — skip, will retry next cycle
          logger.debug({
            msg: "confirmation_check_skipped",
            txHash: tx.txHash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      logger.error({
        msg: "confirmation_worker_error",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
    }
  }

  const interval = setInterval(checkPendingTransactions, intervalMs);
  interval.unref();

  logger.info({
    msg: "confirmation_worker_started",
    intervalMs,
    maxAge,
    batchSize,
    chains: ["evm", "solana"],
  });

  return {
    stop: () => {
      clearInterval(interval);
      logger.info({ msg: "confirmation_worker_stopped" });
    },
  };
}
