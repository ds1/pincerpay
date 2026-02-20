import { Hono } from "hono";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "PincerPay Facilitator API",
    version: "0.1.0",
    description: "On-chain payment gateway for the agentic economy. USDC settlement via x402 protocol.",
    contact: { url: "https://pincerpay.com" },
  },
  servers: [
    { url: "https://facilitator.pincerpay.com", description: "Production" },
    { url: "http://localhost:4402", description: "Local development" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        operationId: "getHealth",
        tags: ["Public"],
        responses: {
          "200": {
            description: "Healthy",
            content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
          },
          "503": { description: "Degraded (DB down or worker errors)" },
        },
      },
    },
    "/supported": {
      get: {
        summary: "Supported networks and schemes",
        operationId: "getSupported",
        tags: ["Public"],
        responses: {
          "200": {
            description: "Registered x402 schemes",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SupportedResponse" } } },
          },
        },
      },
    },
    "/v1/verify": {
      post: {
        summary: "Verify a payment payload",
        operationId: "verifyPayment",
        tags: ["Payments"],
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentRequest" } } },
        },
        responses: {
          "200": {
            description: "Verification result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyResponse" } } },
          },
          "400": { description: "Invalid request body" },
          "401": { description: "Missing or invalid API key" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/v1/settle": {
      post: {
        summary: "Settle a payment on-chain",
        operationId: "settlePayment",
        tags: ["Payments"],
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentRequest" } } },
        },
        responses: {
          "200": {
            description: "Settlement result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SettleResponse" } } },
          },
          "400": { description: "Invalid request body" },
          "401": { description: "Missing or invalid API key" },
          "429": { description: "Rate limit exceeded (50/min)" },
        },
      },
    },
    "/v1/settle-direct": {
      post: {
        summary: "Direct on-chain settlement via Anchor program",
        operationId: "settleDirectPayment",
        tags: ["Payments"],
        security: [{ apiKey: [] }],
        description: "Only available when Anchor program is configured. Solana-only.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SettleDirectRequest" } } },
        },
        responses: {
          "200": {
            description: "Direct settlement result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SettleDirectResponse" } } },
          },
          "400": { description: "Invalid request or non-Solana network" },
          "401": { description: "Missing or invalid API key" },
          "404": { description: "Merchant not found" },
          "429": { description: "Rate limit exceeded (50/min)" },
        },
      },
    },
    "/v1/status/{txHash}": {
      get: {
        summary: "Get transaction status",
        operationId: "getTransactionStatus",
        tags: ["Payments"],
        security: [{ apiKey: [] }],
        parameters: [
          { name: "txHash", in: "path", required: true, schema: { type: "string" }, description: "Transaction hash or signature" },
        ],
        responses: {
          "200": {
            description: "Transaction status",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionStatus" } } },
          },
          "401": { description: "Missing or invalid API key" },
          "404": { description: "Transaction not found" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "x-pincerpay-api-key",
        description: "API key from PincerPay dashboard (pp_live_...)",
      },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ok", "degraded"] },
          service: { type: "string", example: "pincerpay-facilitator" },
          timestamp: { type: "string", format: "date-time" },
          uptime: { type: "integer", description: "Seconds since start" },
          database: { type: "string", enum: ["connected", "disconnected"] },
          workers: {
            type: "object",
            properties: {
              confirmation: { $ref: "#/components/schemas/WorkerStatus" },
              webhookRetry: { $ref: "#/components/schemas/WorkerStatus" },
              onChainRecorder: { $ref: "#/components/schemas/WorkerStatus" },
            },
          },
        },
      },
      WorkerStatus: {
        type: "object",
        properties: {
          running: { type: "boolean" },
          lastCycleAt: { type: "string", format: "date-time", nullable: true },
          cycleCount: { type: "integer" },
          consecutiveErrors: { type: "integer" },
          lastError: { type: "string", nullable: true },
        },
      },
      SupportedResponse: {
        type: "object",
        properties: {
          kinds: {
            type: "array",
            items: {
              type: "object",
              properties: {
                scheme: { type: "string", example: "exact" },
                network: { type: "string", example: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" },
              },
            },
          },
        },
      },
      PaymentRequest: {
        type: "object",
        required: ["paymentPayload", "paymentRequirements"],
        properties: {
          paymentPayload: { type: "object", description: "x402 payment payload" },
          paymentRequirements: {
            type: "object",
            required: ["scheme", "network", "amount", "payTo"],
            properties: {
              scheme: { type: "string", example: "exact" },
              network: { type: "string", example: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" },
              amount: { oneOf: [{ type: "string" }, { type: "integer" }], description: "USDC base units (1 USDC = 1000000)" },
              payTo: { type: "string", description: "Recipient address" },
            },
          },
        },
      },
      VerifyResponse: {
        type: "object",
        properties: {
          isValid: { type: "boolean" },
          payer: { type: "string" },
          invalidReason: { type: "string" },
          invalidMessage: { type: "string" },
        },
      },
      SettleResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          transaction: { type: "string", description: "Tx hash or signature" },
          network: { type: "string" },
          payer: { type: "string" },
        },
      },
      SettleDirectRequest: {
        type: "object",
        required: ["agentAddress", "merchantId", "amount"],
        properties: {
          agentAddress: { type: "string", description: "Solana agent wallet" },
          merchantId: { type: "string", format: "uuid" },
          amount: { type: "string", pattern: "^\\d+$", description: "USDC base units" },
          network: { type: "string", default: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" },
        },
      },
      SettleDirectResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          transactionId: { type: "string", format: "uuid" },
          settlementType: { type: "string", enum: ["direct"] },
          accounts: {
            type: "object",
            properties: {
              config: { type: "string" },
              merchantAccount: { type: "string" },
              merchantUsdcAta: { type: "string" },
              agent: { type: "string" },
            },
          },
          amount: { type: "string" },
          network: { type: "string" },
        },
      },
      TransactionStatus: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          chainId: { type: "string" },
          txHash: { type: "string" },
          fromAddress: { type: "string" },
          toAddress: { type: "string" },
          amount: { type: "string" },
          status: { type: "string", enum: ["pending", "mempool", "optimistic", "confirmed", "failed"] },
          optimistic: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          confirmedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
};

export function createOpenApiRoute() {
  const app = new Hono();
  const json = JSON.stringify(spec);

  app.get("/openapi.json", (c) => {
    return c.body(json, 200, { "Content-Type": "application/json" });
  });

  return app;
}
