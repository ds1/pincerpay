import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const DOCS: Record<string, { title: string; content: string }> = {
  "getting-started": {
    title: "Getting Started with PincerPay",
    content: `# Getting Started with PincerPay

PincerPay is an on-chain USDC payment gateway for AI agents using the x402 protocol (HTTP 402).

## Quick Start

### 1. Create an Account
Sign up at https://pincerpay.com/dashboard and create a merchant profile.

### 2. Get Your API Key
Go to Settings > API Keys and create a new key. It will look like \`pp_live_abc123...\`.

### 3. Install the SDK
\`\`\`bash
# For merchants (accept payments)
npm install @pincerpay/merchant

# For agents (make payments)
npm install @pincerpay/agent
\`\`\`

### 4. Add Payment Walls
Use the \`scaffold-x402-middleware\` MCP tool to generate middleware code for Express or Hono.

## How It Works

1. Merchant wraps API routes with PincerPay middleware
2. Agent calls the API and receives HTTP 402 with payment challenge
3. Agent SDK automatically signs a USDC transfer
4. PincerPay facilitator verifies the signature and broadcasts the transaction
5. Merchant delivers the protected resource

## Supported Chains
- **Solana** (primary) — ~$0.00025 gas, 400ms block time
- **Base** (EVM) — ~$0.001-0.01 gas, 2s block time
- **Polygon** (EVM) — ~$0.001-0.005 gas, 2s block time

## Key Concepts
- **Optimistic Finality**: Payments under $1 USDC are released after mempool broadcast (~200ms)
- **Gas Passthrough**: Agents pay gas costs, not merchants
- **x402 Protocol**: HTTP 402-based payment challenges (Coinbase open standard)`,
  },
  merchant: {
    title: "Merchant Integration Guide",
    content: `# Merchant SDK Integration

## Install

\`\`\`bash
npm install @pincerpay/merchant
\`\`\`

## Express Middleware

\`\`\`typescript
import express from "express";
import { pincerpay } from "@pincerpay/merchant/express";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_WALLET_ADDRESS",
    routes: {
      "GET /api/weather": { price: "0.001", chain: "solana" },
      "GET /api/premium": { price: "0.01", chain: "solana" },
    },
  })
);
\`\`\`

## Hono Middleware

\`\`\`typescript
import { Hono } from "hono";
import { pincerpayHono } from "@pincerpay/merchant/hono";

const app = new Hono();

app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_WALLET_ADDRESS",
    routes: {
      "GET /api/weather": { price: "0.001", chain: "solana" },
    },
  })
);
\`\`\`

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| apiKey | Yes | Your PincerPay API key (\`pp_live_...\`) |
| merchantAddress | Yes | Your USDC wallet address |
| facilitatorUrl | No | Custom facilitator URL (defaults to PincerPay hosted) |
| routes | Yes | Map of route patterns to paywall configs |

## Route Config

| Field | Required | Description |
|-------|----------|-------------|
| price | Yes | USDC price as string (e.g., "0.01") |
| chain | No | Chain shorthand (default: "solana") |
| chains | No | Multiple chains |
| description | No | Shown in 402 response |`,
  },
  agent: {
    title: "Agent Integration Guide",
    content: `# Agent SDK Integration

## Install

\`\`\`bash
npm install @pincerpay/agent
\`\`\`

## Basic Usage

\`\`\`typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});

// agent.fetch() is a drop-in replacement for fetch
const response = await agent.fetch("https://api.example.com/weather");
const data = await response.json();
\`\`\`

## With Spending Policies

\`\`\`typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "0.10",  // Max $0.10 per API call
      maxPerDay: "5.00",          // Max $5.00 per day
    },
  ],
});
\`\`\`

## How x402 Payment Flow Works

1. \`agent.fetch(url)\` calls the merchant API
2. Server returns HTTP 402 with \`X-Payment\` header (x402 challenge)
3. Agent SDK extracts payment requirements (amount, chain, recipient)
4. Agent signs a USDC transfer transaction
5. PincerPay facilitator verifies + broadcasts the transaction
6. Agent retries the original request with the payment proof
7. Server validates payment and returns the protected resource

## Multi-Chain Support

\`\`\`typescript
const agent = await PincerPayAgent.create({
  chains: ["solana", "base"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
});
\`\`\`

The agent automatically selects the correct chain based on the merchant's 402 response.`,
  },
};

export function registerDocsResources(server: McpServer) {
  const topics = Object.keys(DOCS);

  server.resource(
    "docs",
    new ResourceTemplate("docs://pincerpay/{topic}", {
      list: async () => ({
        resources: topics.map((key) => ({
          uri: `docs://pincerpay/${key}`,
          name: DOCS[key]!.title,
          mimeType: "text/markdown" as const,
        })),
      }),
    }),
    async (uri, { topic }) => {
      const doc = DOCS[topic as string];
      if (!doc) {
        throw new Error(
          `Unknown doc topic: "${topic}". Available: ${topics.join(", ")}`,
        );
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: doc.content,
            mimeType: "text/markdown",
          },
        ],
      };
    },
  );
}
