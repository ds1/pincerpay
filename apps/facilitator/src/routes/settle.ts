import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { x402Facilitator } from "@x402/core/facilitator";
import type { Address } from "@solana/kit";
import { createSolanaRpc } from "@solana/kit";
import { resolveChain } from "@pincerpay/core";
import type { Database } from "@pincerpay/db";
import { transactions, agents } from "@pincerpay/db";
import { deriveSmartAccountPda, deriveSettingsPda, deriveSpendingLimitPda } from "@pincerpay/solana/squads";
import type { AppEnv } from "../env.js";
import type { Metrics } from "../metrics.js";
import { paymentRequestSchema } from "./schemas.js";
import { dispatchWebhook } from "../webhooks/dispatcher.js";

interface SettleRouteOptions {
  /** Whether Kora gasless mode is active for Solana transactions */
  koraEnabled?: boolean;
  /** Nudge background workers to poll sooner after a new settlement */
  onSettle?: () => void;
  /** Metrics collector */
  metrics?: Metrics;
  /** Solana RPC URL for Squads PDA discovery (optional) */
  solanaRpcUrl?: string;
}

export function createSettleRoute(
  facilitator: x402Facilitator,
  db: Database,
  options?: SettleRouteOptions,
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

      // Test keys cannot operate on mainnet chains. Reject before reaching x402.
      const environment = c.get("environment");
      if (environment === "test") {
        const chain = resolveChain(String(paymentRequirements.network));
        if (chain && !chain.testnet) {
          logger.warn({
            msg: "settle_rejected_test_key_mainnet",
            requestId,
            network: paymentRequirements.network,
          });
          return c.json(
            {
              error: "test_key_chain_forbidden",
              message: `Test API keys cannot settle on ${chain.shorthand}. Use a testnet chain (e.g. solana-devnet) or a live key.`,
            },
            403,
          );
        }
      }

      logger.info({
        msg: "settle_request",
        requestId,
        network: paymentRequirements.network,
        scheme: paymentRequirements.scheme,
        amount: paymentRequirements.amount,
        payTo: paymentRequirements.payTo,
        environment,
      });

      const settleStart = performance.now();
      const result = await facilitator.settle(
        paymentPayload,
        paymentRequirements,
      );
      const settleDurationMs = Math.round(performance.now() - settleStart);

      options?.metrics?.recordSettle(
        String(result.network ?? paymentRequirements.network),
        result.success,
        settleDurationMs,
      );

      // Record transaction in database
      if (result.success && merchantId) {
        const amount = String(paymentRequirements.amount);
        const isOptimistic =
          BigInt(amount) < BigInt(1_000_000); // < 1 USDC

        const txStatus = isOptimistic ? "optimistic" : "confirmed";

        // Determine gas token from chain namespace
        // When Kora is active, Solana gas is paid in USDC instead of SOL
        const network = String(result.network);
        const gasToken = network.startsWith("solana:")
          ? (options?.koraEnabled ? "USDC" : "SOL")
          : network.startsWith("eip155:137") || network.startsWith("eip155:80002") ? "MATIC"
          : "ETH";

        // Upsert agent: auto-register unknown agents on first payment
        const fromAddress = result.payer ?? "unknown";
        const agentUpsert = fromAddress !== "unknown"
          ? db.select({ id: agents.id, smartAccountPda: agents.smartAccountPda })
              .from(agents)
              .where(and(eq(agents.solanaAddress, fromAddress), eq(agents.merchantId, merchantId)))
              .limit(1)
              .then(async (rows) => {
                if (rows[0]) {
                  // Fire-and-forget: discover Squads PDAs for existing agents without them
                  if (!rows[0].smartAccountPda && network.startsWith("solana:") && options?.solanaRpcUrl) {
                    discoverSquadsPdas(db, rows[0].id, fromAddress, options.solanaRpcUrl, logger);
                  }
                  return rows[0].id;
                }
                // Auto-register: create agent with abbreviated address as name
                const abbrev = fromAddress.slice(0, 4) + "..." + fromAddress.slice(-4);
                const [inserted] = await db.insert(agents).values({
                  merchantId,
                  name: `Agent ${abbrev}`,
                  solanaAddress: fromAddress,
                  status: "active",
                }).returning({ id: agents.id });

                // Fire-and-forget: discover Squads PDAs for newly registered agent
                if (network.startsWith("solana:") && options?.solanaRpcUrl) {
                  discoverSquadsPdas(db, inserted.id, fromAddress, options.solanaRpcUrl, logger);
                }

                return inserted.id;
              })
              .catch(() => null)
          : Promise.resolve(null);

        const apiKeyId = c.get("apiKeyId");
        agentUpsert.then((agentId) => {
          return db.insert(transactions)
            .values({
              merchantId,
              apiKeyId,
              environment,
              chainId: result.network,
              txHash: result.transaction,
              fromAddress,
              toAddress: paymentRequirements.payTo,
              amount,
              gasToken,
              status: txStatus,
              optimistic: isOptimistic,
              agentId,
              endpoint: paymentPayload.resource?.url,
            });
        })
          .then(() => {
            logger.info({
              msg: "transaction_recorded",
              requestId,
              txHash: result.transaction,
            });

            // Dispatch webhook with retry tracking
            const webhookUrl = c.get("webhookUrl");
            if (webhookUrl) {
              dispatchWebhook(db, {
                merchantId,
                environment,
                transactionId: undefined, // transaction ID not returned by insert
                webhookUrl,
                webhookSecret: c.get("webhookSecret"),
                payload: {
                  event: "payment.settled",
                  transaction: {
                    txHash: result.transaction,
                    chainId: result.network,
                    amount,
                    fromAddress: result.payer ?? "unknown",
                    toAddress: paymentRequirements.payTo,
                    status: txStatus,
                    endpoint: paymentPayload.resource?.url,
                  },
                },
                logger,
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

      // Nudge workers to pick up the new transaction sooner
      options?.onSettle?.();

      logger.info({
        msg: "settle_result",
        requestId,
        merchantId,
        success: result.success,
        txHash: result.transaction,
        network: result.network,
        durationMs: settleDurationMs,
      });

      return c.json(result);
    } catch (error) {
      options?.metrics?.recordError("/v1/settle");
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

/**
 * Fire-and-forget: Check if an agent has a Squads Smart Account on-chain.
 * If found, update the agent record with the derived PDAs.
 * This populates data for future Squads middleware spending limit checks.
 */
function discoverSquadsPdas(
  db: Database,
  agentId: string,
  solanaAddress: string,
  rpcUrl: string,
  logger: { info(obj: Record<string, unknown>): void; warn(obj: Record<string, unknown>): void },
): void {
  deriveSmartAccountPda(solanaAddress as Address, 0)
    .then(async ([smartAccountPda]) => {
      const rpc = createSolanaRpc(rpcUrl);
      const acctInfo = await rpc
        .getAccountInfo(smartAccountPda, { encoding: "base64" })
        .send();

      if (!acctInfo.value) return; // No Smart Account on-chain

      const [settingsPda] = await deriveSettingsPda(smartAccountPda);
      const [spendingLimitPda] = await deriveSpendingLimitPda(smartAccountPda, 0);

      await db
        .update(agents)
        .set({
          smartAccountPda: smartAccountPda as string,
          settingsPda: settingsPda as string,
          spendingLimitPda: spendingLimitPda as string,
        })
        .where(eq(agents.id, agentId));

      logger.info({
        msg: "squads_pdas_discovered",
        agentId,
        smartAccountPda,
        settingsPda,
        spendingLimitPda,
      });
    })
    .catch((err) => {
      logger.warn({
        msg: "squads_pda_discovery_error",
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
