# Getting Started with PincerPay

PincerPay is an on-chain payment gateway for the agentic economy. It lets merchants accept USDC payments from AI agents over HTTP using the [x402 protocol](https://github.com/coinbase/x402) — no card networks, no 3% fees, instant settlement.

## How It Works

```
Agent requests resource
        |
        v
Merchant returns HTTP 402 + payment requirements
        |
        v
Agent signs USDC transaction
        |
        v
PincerPay Facilitator verifies + broadcasts transaction
        |
        v
Merchant delivers resource
```

1. An AI agent sends a request to your API endpoint
2. The PincerPay middleware intercepts the request and returns `402 Payment Required` with pricing info
3. The agent's PincerPay client automatically signs a USDC transfer
4. The PincerPay Facilitator verifies the payment and broadcasts the transaction on-chain
5. Your middleware confirms payment and allows the request through

## Quick Start

### 1. Sign Up

Create an account at [pincerpay.com/login](https://pincerpay.com/login). You'll be redirected to the dashboard.

### 2. Create Your Merchant Profile

Go to **Settings** and fill in:
- **Business name** — displayed to agents
- **Wallet address** — your Solana (or EVM) address for receiving USDC
- **Supported chains** — select `solana` (recommended), or add `base` / `polygon` for EVM support

### 3. Generate an API Key

In **Settings**, scroll to the API Keys section. Click **Generate Key**. Copy the key — it's shown only once. The key format is `pp_live_xxxxxxxxxxxx...`.

### 4. Create a Paywall

Go to **Paywalls** and click **New Paywall**:
- **Endpoint** — the route pattern, e.g. `GET /api/weather`
- **Price** — amount in USDC, e.g. `0.01`
- **Description** — what the agent gets (shown in the 402 response)

### 5. Install the SDK

```bash
npm install @pincerpay/merchant
```

### 6. Add the Middleware

See [Merchant SDK Integration](#merchant-sdk-integration) below for Express and Hono examples.

### 7. Test It

Use the agent SDK or `curl` to send a request. Check the **Transactions** page in your dashboard.

---

## Merchant SDK Integration

The `@pincerpay/merchant` package provides middleware for Express and Hono that automatically handles the x402 payment flow.

### Express

```typescript
import express from "express";
import { pincerpay } from "@pincerpay/merchant";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_WALLET_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Current weather data",
      },
      "GET /api/forecast": {
        price: "0.05",
        chain: "solana",
        description: "7-day forecast",
      },
    },
  })
);

app.get("/api/weather", (req, res) => {
  res.json({ temp: 72, condition: "sunny" });
});

app.listen(3000);
```

### Hono

```typescript
import { Hono } from "hono";
import { pincerpayHono } from "@pincerpay/merchant";

const app = new Hono();

app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: "YOUR_SOLANA_WALLET_ADDRESS",
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",
        description: "Current weather data",
      },
    },
  })
);

app.get("/api/weather", (c) => {
  return c.json({ temp: 72, condition: "sunny" });
});

export default app;
```

### Configuration

The `pincerpay()` / `pincerpayHono()` functions accept a `PincerPayConfig` object:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your PincerPay API key (`pp_live_...`) |
| `merchantAddress` | `string` | Yes | Your wallet address for receiving USDC |
| `facilitatorUrl` | `string` | No | Override facilitator URL (default: `https://facilitator.pincerpay.com`) |
| `routes` | `Record<string, RoutePaywallConfig>` | Yes | Map of endpoint patterns to paywall config |

Each route in `routes` accepts:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `price` | `string` | Yes | Price in USDC (e.g. `"0.01"`) |
| `chain` | `string` | No | Chain shorthand (default: `"solana"`) |
| `chains` | `string[]` | No | Multiple chains the agent can pay on |
| `description` | `string` | No | Description shown to agents in 402 response |

**Supported chains:** `solana`, `base`, `polygon`, `solana-devnet`, `base-sepolia`, `polygon-amoy`

---

## Agent SDK Integration

Share this section with developers building AI agents that will pay for your API.

### Install

```bash
npm install @pincerpay/agent
```

### Basic Usage

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "100000",  // 0.10 USDC (6 decimals)
      maxPerDay: "5000000",         // 5.00 USDC
    },
  ],
});

// Use agent.fetch() as a drop-in replacement for fetch
const response = await agent.fetch("https://your-api.com/api/weather");
const data = await response.json();
```

`agent.fetch()` works like the standard `fetch()` API. When it receives a `402 Payment Required` response, it automatically:

1. Reads the payment requirements from the response
2. Signs a USDC transfer for the requested amount
3. Retries the request with the signed payment attached
4. Returns the successful response

### EVM Agents

```typescript
const agent = await PincerPayAgent.create({
  chains: ["base-sepolia"],
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
  policies: [
    { maxPerTransaction: "100000", maxPerDay: "5000000" },
  ],
});
```

### Multi-Chain Agents

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana", "base"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
});
```

### Spending Policies

Policies are enforced client-side before signing any transaction:

| Option | Type | Description |
|--------|------|-------------|
| `maxPerTransaction` | `string` | Max USDC per single payment (base units, 6 decimals) |
| `maxPerDay` | `string` | Max USDC spend per 24-hour rolling window |
| `allowedMerchants` | `string[]` | Restrict payments to specific wallet addresses |
| `allowedChains` | `string[]` | Restrict to specific chains |

### Solana Smart Agent (Advanced)

For agents using Squads Protocol for on-chain spending limits:

```typescript
import { SolanaSmartAgent } from "@pincerpay/agent";

const agent = await SolanaSmartAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  smartAccountIndex: 0,
  spendingLimitIndex: 0,
});

// Check on-chain spending policy
const policy = await agent.checkOnChainPolicy("100000");
if (policy.allowed) {
  const response = await agent.fetch("https://your-api.com/api/data");
}

// Direct on-chain settlement (bypasses x402 for Solana-native)
const result = await agent.settleDirectly("MERCHANT_ID", "100000");
```

---

## Testing

### Use Devnet / Testnet

For development, use testnet chains to avoid spending real USDC:

**Merchant config:**
```typescript
pincerpay({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddress: "YOUR_DEVNET_WALLET",
  routes: {
    "GET /api/weather": {
      price: "0.01",
      chain: "solana-devnet",  // Use devnet
      description: "Weather data",
    },
  },
})
```

**Agent config:**
```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana-devnet"],  // Match the merchant's chain
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
});
```

### Get Test USDC

- **Solana devnet:** Use the [Solana faucet](https://faucet.solana.com) for SOL, then swap for devnet USDC
- **Base Sepolia:** Use the [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

### Verify in Dashboard

After a test payment, check your PincerPay dashboard:

1. **Transactions** page shows all payments with status (`pending` → `confirmed`)
2. Click a transaction to see chain, amount, agent address, and on-chain tx hash
3. **Analytics** page shows volume and payment trends

---

## Configuration Reference

### Environment Variables

#### Merchant Server

| Variable | Required | Description |
|----------|----------|-------------|
| `PINCERPAY_API_KEY` | Yes | Your API key from the dashboard |

#### Agent

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_SOLANA_KEY` | For Solana | Solana private key (base58 encoded) |
| `AGENT_EVM_KEY` | For EVM | EVM private key (hex, `0x` prefixed) |

### USDC Amounts

All amounts use **6 decimal places** (USDC standard):

| Human-Readable | Base Units |
|----------------|------------|
| $0.01 | `"10000"` |
| $0.10 | `"100000"` |
| $1.00 | `"1000000"` |
| $10.00 | `"10000000"` |

Use the `toBaseUnits()` helper from `@pincerpay/merchant`:

```typescript
import { toBaseUnits } from "@pincerpay/merchant";

toBaseUnits("0.01"); // "10000"
toBaseUnits("1.00"); // "1000000"
```

### Chain Identifiers

| Shorthand | CAIP-2 ID | Network |
|-----------|-----------|---------|
| `solana` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Solana Mainnet |
| `solana-devnet` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Solana Devnet |
| `base` | `eip155:8453` | Base Mainnet |
| `base-sepolia` | `eip155:84532` | Base Sepolia |
| `polygon` | `eip155:137` | Polygon Mainnet |
| `polygon-amoy` | `eip155:80002` | Polygon Amoy |
