import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";
import { registerListChains } from "./list-chains.js";
import { registerEstimateGas } from "./estimate-gas.js";
import { registerValidateConfig } from "./validate-config.js";
import { registerCheckTransaction } from "./check-transaction.js";
import { registerScaffoldMiddleware } from "./scaffold-middleware.js";
import { registerScaffoldAgent } from "./scaffold-agent.js";
import { registerGenerateUcp } from "./generate-ucp.js";
import { registerCheckHealth } from "./check-health.js";
import { registerGetMetrics } from "./get-metrics.js";
import { registerVerifyPayment } from "./verify-payment.js";
import { registerListPaywalls } from "./list-paywalls.js";
import { registerCreatePaywall } from "./create-paywall.js";
import { registerUpdatePaywall } from "./update-paywall.js";
import { registerDeletePaywall } from "./delete-paywall.js";
import { registerListTransactions } from "./list-transactions.js";
import { registerListAgents } from "./list-agents.js";
import { registerUpdateAgent } from "./update-agent.js";
import { registerListWebhooks } from "./list-webhooks.js";
import { registerRetryWebhook } from "./retry-webhook.js";
import { registerGetMerchantProfile } from "./get-merchant-profile.js";
import { registerBootstrapWallets } from "./bootstrap-wallets.js";
import { registerBootstrapMerchant } from "./bootstrap-merchant.js";
import { registerCreateApiKey, registerListMerchants } from "./create-api-key.js";
import { registerWhoami } from "./whoami.js";
import { registerLoginInstructions } from "./login-instructions.js";

export function registerTools(server: McpServer, client: FacilitatorClient) {
  // Monitoring tools (no auth)
  registerListChains(server, client);
  registerEstimateGas(server);
  registerCheckHealth(server, client);
  registerGetMetrics(server, client);

  // Operations tools (auth required)
  registerCheckTransaction(server, client);
  registerVerifyPayment(server, client);

  // Paywall CRUD (auth required)
  registerListPaywalls(server, client);
  registerCreatePaywall(server, client);
  registerUpdatePaywall(server, client);
  registerDeletePaywall(server, client);

  // Transaction listing (auth required)
  registerListTransactions(server, client);

  // Agent management (auth required)
  registerListAgents(server, client);
  registerUpdateAgent(server, client);

  // Webhook observability (auth required)
  registerListWebhooks(server, client);
  registerRetryWebhook(server, client);

  // Merchant profile (auth required)
  registerGetMerchantProfile(server, client);

  // Developer tools (scaffolding + validation, no auth)
  registerValidateConfig(server);
  registerScaffoldMiddleware(server);
  registerScaffoldAgent(server);
  registerGenerateUcp(server);

  // Onboarding tools
  // - bootstrap-wallets: pure client-side crypto, always available
  // - bootstrap-merchant / create-api-key / list-merchants: dual auth mode —
  //   admin via DATABASE_URL, OR public via ~/.pincerpay/credentials.json
  //   (created by `npx @pincerpay/cli signup` or `login`).
  // - whoami / login-instructions: helper tools for diagnosing auth state.
  registerBootstrapWallets(server);
  registerBootstrapMerchant(server);
  registerCreateApiKey(server);
  registerListMerchants(server);
  registerWhoami(server);
  registerLoginInstructions(server);
}
