---
title: Mainnet Deployment
description: Migrate from devnet to Solana mainnet for production USDC payments.
order: 7
section: Reference
---

This guide covers everything you need to move from devnet testing to accepting real USDC payments on Solana mainnet. At launch, only Solana mainnet is supported for production. EVM chains (Base, Polygon) remain on their respective testnets.

## Overview

The core architecture stays the same. The differences between devnet and mainnet are:

| Setting | Devnet | Mainnet |
|---------|--------|---------|
| Chain identifier | `solana-devnet` | `solana` |
| USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDC value | Faucet tokens (worthless) | Real USD-backed stablecoins |
| Facilitator URL | `https://facilitator.pincerpay.com` | `https://facilitator.pincerpay.com` (same) |
| Solana RPC | Public devnet RPC | Public mainnet RPC (rate-limited) |
| Gas cost | Free (airdrop SOL) | ~$0.00025 per tx (or USDC via Kora) |

The facilitator URL does not change. PincerPay's facilitator automatically routes to the correct chain based on the `chain` field in your configuration.

## For Merchants

### 1. Update Chain Configuration

Change `"solana-devnet"` to `"solana"` in your route definitions.

```typescript
import { Hono } from "hono";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

const app = new Hono();

app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY!,
    merchantAddress: process.env.MERCHANT_ADDRESS!,
    routes: {
      "GET /api/weather": {
        price: "0.01",
        chain: "solana",  // was "solana-devnet"
        description: "Current weather data",
      },
      "GET /api/forecast": {
        price: "0.05",
        chain: "solana",  // was "solana-devnet"
        description: "7-day forecast",
      },
    },
  })
);
```

**Multi-chain merchants** swap `merchantAddress` for `merchantAddresses` and supply per-chain mainnet wallets:

```typescript
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
```

> **No cross-chain conversion.** Agents pay on whichever chain they hold USDC; PincerPay routes settlement to your registered wallet on that chain. If an agent pays on Polygon, USDC arrives in your Polygon wallet — not your Solana one. See [Merchant SDK → Multi-chain Receiving Wallets](/docs/merchant-sdk#multi-chain-receiving-wallets).

### 2. Update Wallet Address

Set the receiving wallet(s) to mainnet wallets you control. These are the addresses that receive USDC payments. Devnet addresses are valid on mainnet (same key format), but verify that you have the private key backed up for the addresses you use.

```bash
# .env (single-chain)
MERCHANT_ADDRESS=YourSolanaMainnetWalletAddress

# .env (multi-chain)
MERCHANT_ADDRESS_SOLANA=YourSolanaMainnetWalletAddress
MERCHANT_ADDRESS_POLYGON=0xYourPolygonWalletAddress
MERCHANT_ADDRESS_BASE=0xYourBaseWalletAddress
```

### 3. Verify Webhook Endpoint

If you have a webhook URL configured in the [dashboard](https://www.pincerpay.com/dashboard), confirm it is publicly reachable before going live. The facilitator sends `POST` requests to your webhook URL on payment events.

```bash
# Quick reachability check
curl -X POST https://your-server.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

All webhook deliveries include an `X-PincerPay-Signature` header for verifying that the payload originated from PincerPay. See the [API Reference](/docs/api-reference) for webhook signature verification details.

### 4. Rotate API Keys (Recommended)

If your devnet API key was used in development environments, CI logs, or shared with teammates, generate a fresh key for production:

1. Open the [PincerPay dashboard](https://www.pincerpay.com/dashboard)
2. Navigate to Settings > API Keys
3. Create a new key
4. Update your production environment with the new `pp_live_...` key
5. Revoke the old key

```bash
# .env (production)
PINCERPAY_API_KEY=pp_live_new_production_key_here
```

### 5. Environment Variables Summary

| Variable | Devnet Value | Mainnet Value |
|----------|-------------|---------------|
| `PINCERPAY_API_KEY` | `pp_live_...` (dev key) | `pp_live_...` (fresh key recommended) |
| `MERCHANT_ADDRESS` | Devnet wallet (single-chain only) | Mainnet wallet (single-chain only) |
| `MERCHANT_ADDRESS_SOLANA` | Solana devnet wallet | Solana mainnet wallet |
| `MERCHANT_ADDRESS_POLYGON` | Polygon Amoy wallet | Polygon mainnet wallet |
| `MERCHANT_ADDRESS_BASE` | Base Sepolia wallet | Base mainnet wallet |

No changes needed for `facilitatorUrl` -- the default (`https://facilitator.pincerpay.com`) handles both devnet and mainnet.

## For Agents

### 1. Update Chain Configuration

Change `"solana-devnet"` to `"solana"` in `PincerPayAgent.create()`:

```typescript
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana"],  // was ["solana-devnet"]
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "1000000",  // 1.00 USDC
      maxPerDay: "10000000",         // 10.00 USDC
    },
  ],
});
```

### 2. Fund Wallet with Real USDC

Your agent wallet needs real USDC on Solana mainnet. There is no faucet for mainnet USDC. Options:

- Transfer USDC from an exchange (Coinbase, Kraken, etc.) to the agent's Solana address
- Bridge USDC from another chain using [Circle CCTP](https://www.circle.com/en/cross-chain-transfer-protocol)
- Send USDC from another Solana wallet

Verify the balance before going live:

```bash
# Check USDC balance (requires solana-cli)
solana balance --url mainnet-beta <agent-address>

# Or check the USDC token account
spl-token balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --owner <agent-address> \
  --url mainnet-beta
```

### 3. Use a Dedicated RPC Provider

The public Solana mainnet RPC (`https://api.mainnet-beta.solana.com`) is heavily rate-limited and not suitable for production agents. Use a dedicated RPC provider:

| Provider | Free Tier | Link |
|----------|-----------|------|
| Helius | 50k req/day | [helius.dev](https://www.helius.dev/) |
| Triton | 100k req/day | [triton.one](https://triton.one/) |
| QuickNode | 25 req/sec | [quicknode.com](https://www.quicknode.com/) |

Configure the RPC URL in your agent's environment:

```bash
# .env
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  solanaRpcUrl: process.env.SOLANA_RPC_URL,  // custom RPC
  policies: [
    {
      maxPerTransaction: "1000000",
      maxPerDay: "10000000",
    },
  ],
});
```

### 4. Adjust Spending Policies

Devnet policies are often set low for testing. For mainnet, set limits that match your agent's actual use case. Remember that amounts are in USDC base units (6 decimals).

| Use Case | maxPerTransaction | maxPerDay | Notes |
|----------|-------------------|-----------|-------|
| Micropayments (API calls) | `100000` (0.10) | `5000000` (5.00) | Most API-calling agents |
| Medium value (data feeds) | `1000000` (1.00) | `50000000` (50.00) | Data aggregation agents |
| High value (procurement) | `10000000` (10.00) | `100000000` (100.00) | Requires careful oversight |

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "100000",   // 0.10 USDC per payment
      maxPerDay: "5000000",          // 5.00 USDC daily cap
      allowedMerchants: [            // restrict to known merchants
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      ],
    },
  ],
});
```

Start with conservative limits and increase as you gain confidence in your agent's spending patterns. Use `agent.getDailySpend()` to monitor usage.

### 5. Kora Gasless Mode

With Kora integration, agents pay gas fees in USDC instead of SOL. This means your agent wallet does not need to hold any SOL -- all costs are denominated in USDC.

When Kora is enabled on the facilitator, gas is automatically deducted from the payment amount. No agent-side configuration is required.

Without Kora, agents need a small SOL balance for transaction fees (~0.000005 SOL per transfer, roughly $0.00025).

## Wallet Security

### Store Keys in Encrypted Environment Variables

Never hardcode private keys in source code. At minimum, store them in environment variables loaded from `.env` files that are excluded from version control:

```bash
# .env (never committed)
AGENT_SOLANA_KEY=your_base58_private_key_here
MERCHANT_PRIVATE_KEY=your_merchant_key_here
```

For production deployments, use your platform's secrets manager:

- **Railway**: Environment variables in service settings (encrypted at rest)
- **Vercel**: Environment variables (encrypted, scoped per environment)
- **AWS**: Secrets Manager or Parameter Store
- **GCP**: Secret Manager

### Consider Squads Multi-Sig for Facilitator Wallets

For Solana wallets holding significant value, use a [Squads](https://squads.so/) multi-sig. This requires multiple signers to approve outbound transfers, protecting against single-key compromise. The PincerPay dashboard supports creating and managing Squads Smart Accounts for agent wallets with on-chain spending limits.

### Verify .gitignore Coverage

Before deploying, confirm your `.gitignore` includes:

```
.env
.env.*
.env.local
.env.production
*.pem
*.key
```

Run a quick check:

```bash
# Ensure no secrets are tracked
git ls-files | grep -E '\.env|\.pem|\.key'
# Should return nothing
```

### Rotate Keys Periodically

Set a rotation schedule for all private keys and API keys:

- **API keys**: Rotate every 90 days or after any team member departure
- **Agent wallet keys**: Rotate when compromised or when agent scope changes
- **Facilitator keys**: Rotate on a quarterly basis with coordinated deployment

## Deployment Checklist

### Merchant

- [ ] Change `chain` from `"solana-devnet"` to `"solana"` in all route definitions
- [ ] Set `merchantAddress` (single-chain) or `merchantAddresses` (multi-chain) to mainnet wallets you control
- [ ] Verify private key backup exists for the mainnet wallet
- [ ] Confirm webhook URL is publicly reachable (if configured)
- [ ] Verify `X-PincerPay-Signature` validation is implemented on webhook endpoint
- [ ] Generate a fresh API key for production (revoke dev keys)
- [ ] Update production environment variables
- [ ] Confirm `.gitignore` covers `.env*` files
- [ ] Deploy and test with a small real payment (0.001 USDC)

### Agent

- [ ] Change `chains` from `["solana-devnet"]` to `["solana"]` in `PincerPayAgent.create()`
- [ ] Fund agent wallet with real USDC on Solana mainnet
- [ ] Configure a dedicated RPC provider (Helius, Triton, or QuickNode)
- [ ] Set production spending policies (`maxPerTransaction`, `maxPerDay`)
- [ ] Restrict `allowedMerchants` to known merchant addresses (if applicable)
- [ ] Store private key in platform secrets manager (not `.env` on disk)
- [ ] Confirm `.gitignore` covers `.env*` files
- [ ] Test with a small real payment against a mainnet merchant
