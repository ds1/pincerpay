import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const DOCS: Record<string, { title: string; content: string }> = {
  "getting-started": {
    title: "Getting Started with PincerPay",
    content: `# Getting Started with PincerPay

PincerPay is an on-chain USDC payment gateway for AI agents using the x402 protocol (HTTP 402).
No card rails — pure stablecoin settlement on Solana (primary), Base, and Polygon.

## Prerequisites

- Node.js 22+
- \`"type": "module"\` in your package.json — both SDKs are **ESM-only**. Without this, you'll get \`ERR_MODULE_NOT_FOUND\`.
- A USDC wallet (Solana or EVM) for receiving/sending payments

## Choose Your Path

### Merchant — Accept USDC payments from AI agents
You have an API and want to add payment walls so agents pay per request.

1. **Install**: \`npm install @pincerpay/merchant\`
2. **Get an API key**: Sign up at https://pincerpay.com/dashboard → Settings → API Keys (\`pp_live_...\`)
3. **Generate code**: Use the \`scaffold-x402-middleware\` tool (supports Express, Hono, Next.js)
4. **Validate config**: Use the \`validate-payment-config\` tool to check your setup
5. **Add discovery**: Use the \`generate-ucp-manifest\` tool for agent discoverability

→ Full guide: \`docs://pincerpay/merchant\`

### Agent Developer — Build agents that pay for API access
You're building an AI agent that needs to automatically pay for paywalled APIs.

1. **Install**: \`npm install @pincerpay/agent\`
2. **Generate code**: Use the \`scaffold-agent-client\` tool with your chain and spending limits
3. **Estimate costs**: Use the \`estimate-gas-cost\` tool to understand fees on your chain

→ Full guide: \`docs://pincerpay/agent\`

### Already Integrated? Troubleshooting
Use the \`debug-transaction\` prompt with your transaction hash, or see \`docs://pincerpay/troubleshooting\`.

## Security Checklist
- Add \`.env*\` to \`.gitignore\` — **never commit API keys or private keys**
- Store wallet keys in environment variables, not source code
- Use \`pp_test_\` keys and devnet chains during development

## Devnet vs Mainnet

| Environment | Chain Shorthand | Notes |
|-------------|----------------|-------|
| Development | \`"solana-devnet"\` | Free devnet USDC. Use Solana faucet for SOL. |
| Development | \`"base-sepolia"\` | Free testnet USDC via Circle faucet. |
| Production | \`"solana"\` | Real USDC on Solana mainnet. |
| Production | \`"base"\` | Real USDC on Base mainnet. |

**Both merchant and agent must use the same chain** (e.g., both on \`"solana-devnet"\`).

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
- **Gas Passthrough**: Agents pay gas costs in USDC (via Kora on Solana, meta-txns on EVM), not merchants
- **x402 Protocol**: HTTP 402-based payment challenges (Coinbase open standard)
- **Prices vs Policies**: Route \`price\` uses human-readable amounts ("0.01"), spending \`policies\` use base units ("10000")`,
  },
  merchant: {
    title: "Merchant Integration Guide",
    content: `# Merchant SDK Integration

## Install

\`\`\`bash
npm install @pincerpay/merchant
\`\`\`

Install with Hono as a peer dependency: \`npm install @pincerpay/merchant hono\`.

## Next.js Middleware

\`\`\`typescript
// app/api/[...route]/route.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono().basePath("/api");

app.use("*", createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_SOLANA_WALLET_ADDRESS",
  routes: {
    "GET /api/weather": {
      price: "0.01",
      chain: "solana",
    },
  },
}));

app.get("/weather", (c) => {
  return c.json({ forecast: "sunny", temp: 72 });
});

export const GET = handle(app);
export const POST = handle(app);
\`\`\`

**Notes:** \`basePath("/api")\` must match the catch-all location. Route handlers use paths relative to basePath (\`/weather\` → \`/api/weather\`).

## Multi-Chain Routes

Accept payments on multiple chains per route — agents auto-select the chain they have funds on:

\`\`\`typescript
routes: {
  "GET /api/weather": {
    price: "0.01",
    chains: ["solana", "base", "polygon"],
  },
}
\`\`\`

If neither \`chain\` nor \`chains\` is specified, defaults to \`"solana"\`.

## Multi-Chain Receiving Wallets

Solana and EVM addresses are categorically different formats. Use \`merchantAddresses\` to bind one wallet per chain:

\`\`\`typescript
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddresses: {
    solana:  process.env.MERCHANT_ADDRESS_SOLANA!,
    polygon: process.env.MERCHANT_ADDRESS_POLYGON!,
    base:    process.env.MERCHANT_ADDRESS_BASE!,
  },
  routes: {
    "POST /api/trade": { price: "0.05", chains: ["solana", "polygon", "base"] },
  },
});
\`\`\`

Agents pay on whichever chain they hold USDC; PincerPay routes settlement to your registered wallet on that chain. **No cross-chain conversion happens.** Format validation is fail-fast at middleware init with chain-named errors.

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| apiKey | Yes | Your PincerPay API key (\`pp_live_...\` or \`pp_test_...\`) |
| merchantAddress | If \`merchantAddresses\` not set | Single-chain receiving wallet (legacy / fallback) |
| merchantAddresses | If \`merchantAddress\` not set | Per-chain wallets keyed by chain shorthand (\`solana\`, \`polygon\`, \`base\`, ...) |
| facilitatorUrl | No | Custom facilitator URL (defaults to PincerPay hosted) |
| routes | Yes | Map of route patterns to paywall configs |

## Route Config

| Field | Required | Description |
|-------|----------|-------------|
| price | Yes | USDC price as human-readable string (e.g., "0.01" = 1 cent) |
| chain | No | Chain shorthand (default: "solana") |
| chains | No | Array of chain shorthands for multi-chain support |
| description | No | Human-readable description shown in 402 response |

## Utility: toBaseUnits

Convert human-readable USDC to base units (useful for spending policies):

\`\`\`typescript
import { toBaseUnits } from "@pincerpay/merchant";
toBaseUnits("0.01"); // → "10000"
toBaseUnits("1.00"); // → "1000000"
\`\`\``,
  },
  agent: {
    title: "Agent Integration Guide",
    content: `# Agent SDK Integration

## Install

\`\`\`bash
npm install @pincerpay/agent
\`\`\`

No peer dependencies — transitive deps (\`@solana/kit\`, \`viem\`, \`@x402/*\`) install automatically.

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

**Note:** \`PincerPayAgent.create()\` is async (required for Solana key derivation). For EVM-only agents, you can also use \`new PincerPayAgent(config)\` (synchronous).

## With Spending Policies

**Important:** Spending policies use **base units** (6 decimals), NOT human-readable amounts. \`BigInt("0.10")\` will throw at runtime!

\`\`\`typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  // Spending policies use base units: 1 USDC = "1000000", $0.10 = "100000"
  policies: [
    {
      maxPerTransaction: "100000",   // $0.10 per API call
      maxPerDay: "5000000",          // $5.00 per day
    },
  ],
});
\`\`\`

| Human Amount | Base Units |
|-------------|------------|
| $0.01 | \`"10000"\` |
| $0.10 | \`"100000"\` |
| $1.00 | \`"1000000"\` |
| $10.00 | \`"10000000"\` |

Multiply human amount × 1,000,000 to get base units. Or use \`toBaseUnits("0.10")\` from \`@pincerpay/merchant\`.

## Runtime Policy Management

\`\`\`typescript
// Pre-check if a payment would be allowed
const check = agent.checkPolicy("500000"); // 0.50 USDC
if (!check.allowed) console.log(check.reason);

// Update spending limits dynamically
agent.setPolicy({ maxPerTransaction: "5000000", maxPerDay: "50000000" });

// Monitor daily spending
const { date, amount } = agent.getDailySpend();
console.log(\`Spent \${amount} base units on \${date}\`);

// Get current policy
const policy = agent.getPolicy();
\`\`\`

## Agent Properties

| Property | Description |
|----------|-------------|
| \`agent.fetch(url, init?)\` | Payment-enabled fetch — auto-handles 402 challenges |
| \`agent.solanaAddress\` | Agent's Solana public key (only available via \`.create()\`) |
| \`agent.evmAddress\` | Agent's EVM public address |
| \`agent.chains\` | Configured chain shorthands |
| \`agent.checkPolicy(amountBaseUnits)\` | Pre-check \`{ allowed, reason? }\` against spending limits |
| \`agent.setPolicy(policy)\` | Replace spending policy at runtime |
| \`agent.getPolicy()\` | Get current spending policy |
| \`agent.getDailySpend()\` | Get \`{ date: string, amount: bigint }\` for today's tracked spend |

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

The agent automatically selects the correct chain based on the merchant's 402 response.

## Environment Variables

\`\`\`
AGENT_SOLANA_KEY=your_base58_private_key_here
# or for EVM:
AGENT_EVM_KEY=0xyour_hex_private_key_here
\`\`\`

**Never commit private keys.** Ensure \`.env*\` is in \`.gitignore\`.`,
  },
  troubleshooting: {
    title: "Troubleshooting Common Issues",
    content: `# Troubleshooting

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| \`ERR_MODULE_NOT_FOUND\` | ESM import issues | Add \`"type": "module"\` to package.json or use \`.mts\` extension. Both \`@pincerpay/merchant\` and \`@pincerpay/agent\` are ESM-only. |
| \`SyntaxError: Cannot use import statement\` | CommonJS project importing ESM | Add \`"type": "module"\` to package.json. |
| 402 but no payment attempted | Chain mismatch | Agent and merchant must use the same chain (e.g., both \`"solana-devnet"\`). Check \`chains\` array. |
| \`Invalid base58 character\` | Wrong key format for Solana | Solana private keys are base58 (alphanumeric, no \`0x\` prefix). EVM keys are hex (\`0x...\`). |
| Payment succeeds but 402 persists | Facilitator URL mismatch | Both merchant and agent must use the same facilitator. Default: \`https://facilitator.pincerpay.com\`. |
| \`Exceeds per-transaction limit\` | Spending policy too restrictive | Increase \`maxPerTransaction\` — value is in **base units** (6 decimals). \`"1000000"\` = $1.00 USDC. |
| \`BigInt("0.10")\` throws | Human-readable amount in policy | Policies use base units, not human amounts. Use \`"100000"\` not \`"0.10"\` for $0.10. |
| \`At least one wallet key required\` | No private key configured | Set \`solanaPrivateKey\` or \`evmPrivateKey\` in agent config. Check \`.env\` is loaded. |
| Route not matching for 402 | Wrong route pattern format | Pattern must be \`"METHOD /path"\` — e.g., \`"GET /api/weather"\`. Uppercase method, space, leading slash. |
| \`pp_live_\` key on devnet | API key environment mismatch | Use \`pp_test_\` keys for devnet chains. |

## Devnet Funding

- **Solana devnet SOL**: https://faucet.solana.com
- **Solana devnet USDC**: Request from PincerPay team or use a devnet DEX
- **Base Sepolia ETH**: Base Sepolia faucet
- **Base Sepolia USDC**: Circle testnet USDC faucet

## Debugging Tips

1. **Verify 402 response**: \`curl -s -w "\\nHTTP Status: %{http_code}\\n" http://localhost:3000/api/endpoint\` — should return 402 with \`paymentRequirements\` JSON
2. **Check chain match**: Both merchant route config and agent \`chains\` array must use identical chain shorthands
3. **Test agent fetch**: \`const response = await agent.fetch(url); console.log(response.status);\` — should be 200 after payment
4. **Inspect spending**: \`console.log(agent.getDailySpend())\` to see current daily spend tracking
5. **Validate config**: Use the \`validate-payment-config\` MCP tool to check your merchant config for errors`,
  },
  reference: {
    title: "API Reference",
    content: `# PincerPay Reference

## Chain Shorthands

| Shorthand | Network | CAIP-2 ID | Notes |
|-----------|---------|-----------|-------|
| \`solana\` | Solana Mainnet | \`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp\` | Primary chain, default |
| \`solana-devnet\` | Solana Devnet | \`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1\` | Solana testnet |
| \`base\` | Base Mainnet | \`eip155:8453\` | EVM, low fees |
| \`base-sepolia\` | Base Sepolia | \`eip155:84532\` | EVM testnet |
| \`polygon\` | Polygon Mainnet | \`eip155:137\` | EVM |
| \`polygon-amoy\` | Polygon Amoy | \`eip155:80002\` | Polygon testnet |

## USDC Amounts (6 Decimals)

Route \`price\` fields use human-readable strings. Spending \`policies\` use base unit strings.

| Human Amount | Base Units | Route \`price\` | Policy value |
|-------------|------------|---------------|--------------|
| $0.001 | 1,000 | \`"0.001"\` | \`"1000"\` |
| $0.01 | 10,000 | \`"0.01"\` | \`"10000"\` |
| $0.10 | 100,000 | \`"0.10"\` | \`"100000"\` |
| $1.00 | 1,000,000 | \`"1.00"\` | \`"1000000"\` |
| $10.00 | 10,000,000 | \`"10.00"\` | \`"10000000"\` |
| $100.00 | 100,000,000 | \`"100.00"\` | \`"100000000"\` |

Convert: multiply human amount × 1,000,000. Or use \`toBaseUnits("0.01")\` from \`@pincerpay/merchant\`.

## Package Exports

| Package | Key Exports |
|---------|-------------|
| \`@pincerpay/merchant\` | \`createPincerPayMiddleware\`, \`PincerPayClient\` (low-level), \`toBaseUnits\`, \`resolveRouteChains\`, \`getUsdcAsset\` |
| \`@pincerpay/merchant/nextjs\` | \`createPincerPayMiddleware\` (sub-path import) |
| \`@pincerpay/agent\` | \`PincerPayAgent\` (main agent class) |
| \`@pincerpay/core\` | \`PincerPayConfig\`, \`AgentConfig\`, \`SpendingPolicy\`, \`RoutePaywallConfig\`, \`ChainConfig\` (types) |

## PincerPayClient Methods (Low-Level)

For advanced users building custom middleware:

| Method | Description |
|--------|-------------|
| \`verify(paymentPayload, paymentRequirements)\` | Verify a raw x402 payment payload |
| \`settle(paymentPayload, paymentRequirements)\` | Settle a verified payment on-chain |
| \`getSupported()\` | Get supported schemes/networks from the facilitator |
| \`getStatus(txHash)\` | Get transaction status by hash |

Most users should use \`createPincerPayMiddleware()\` instead.

## PincerPayAgent Properties & Methods

| Member | Description |
|--------|-------------|
| \`agent.fetch(url, init?)\` | Payment-enabled fetch — auto-handles 402 challenges |
| \`agent.solanaAddress\` | Agent's Solana public key (only via \`.create()\`) |
| \`agent.evmAddress\` | Agent's EVM public address |
| \`agent.chains\` | Configured chain shorthands |
| \`agent.checkPolicy(amountBaseUnits)\` | Pre-check \`{ allowed, reason? }\` against spending limits |
| \`agent.setPolicy(policy)\` | Replace spending policy at runtime |
| \`agent.getPolicy()\` | Get current spending policy |
| \`agent.getDailySpend()\` | Get \`{ date: string, amount: bigint }\` for today's tracked spend |

## Route Pattern Format

Route patterns must follow this format: \`"METHOD /path"\`

- **Method**: Uppercase HTTP method (GET, POST, PUT, DELETE, PATCH)
- **Space**: Single space between method and path
- **Path**: Must start with \`/\`

Examples: \`"GET /api/weather"\`, \`"POST /api/submit"\`, \`"GET /api/data/:id"\``,
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
