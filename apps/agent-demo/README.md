# PincerPay Agent Demo

**[demo.pincerpay.com](https://demo.pincerpay.com)**

Interactive playground and CLI demo showing the **agent developer experience** — what it looks like for an AI agent to discover, pay for, and consume a paid API using the [x402 protocol](https://github.com/coinbase/x402) and [PincerPay](https://pincerpay.com).

## Why This Exists

The merchant side of PincerPay has a full dashboard, onboarding wizard, and docs. But the other half of the story — **"I'm building an AI agent that needs to call a paid API, what does that look like?"** — didn't have a clear answer. This demo fills that gap with:

- A **web playground** where you can simulate the full x402 payment flow step-by-step
- A **CLI walkthrough** that shows the same flow in the terminal
- A **landing page** that explains the value prop in 30 seconds

It runs entirely in simulation mode by default — no wallet, no devnet tokens, no facilitator needed. Just `npm install && npm run dev`.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Open Playground**, or try the [Guided Demo](https://demo.pincerpay.com/playground?tour=1) to walk through the full flow with narration.

## What the Demo Shows

### The x402 Payment Flow

Every API request follows this 6-step flow, animated in real time:

```
1. Agent sends HTTP request       →  GET /api/weather
2. Server returns 402 challenge   →  "Pay 0.001 USDC on Solana"
3. Agent signs payment             →  Wallet authorizes USDC transfer
4. Facilitator verifies signature  →  Checks payment proof is valid
5. Payment settles on-chain        →  USDC transferred, tx confirmed
6. Data delivered                  →  Agent receives API response
```

The key insight: **the agent's code is just `agent.fetch(url)`** — PincerPay handles the 402 challenge, payment signing, and retry automatically under the hood.

### Spending Policies

Agents don't have unlimited wallets. The demo shows how spending policies work:

- **Per-request limit**: Agent refuses to pay more than X USDC for a single request
- **Daily budget**: Agent tracks cumulative spend and stops when the budget is exhausted
- **Error handling**: When a request exceeds policy, the flow stops at step 3 with a clear error

Try it: set max per request to 0.001 USDC, then try to call `/api/premium-analytics` (0.10 USDC).

### Mock Merchant Endpoints

| Endpoint | Price | What It Returns |
|----------|-------|-----------------|
| `GET /api/weather` | 0.001 USDC | Weather data (city, temp, forecast) |
| `GET /api/market-data` | 0.01 USDC | Crypto prices (BTC, ETH, SOL) |
| `GET /api/research` | 0.05 USDC | AI research summary with sources |
| `GET /api/premium-analytics` | 0.10 USDC | Analytics dashboard data |

These span 2 orders of magnitude in price to show micropayments ($0.001) through small payments ($0.10).

## Demo Modes

### Simulation (default)

No real crypto, no funded wallet, no facilitator. A simulation engine generates realistic flow steps with timing, fake Solana addresses, and fake transaction hashes. Works completely offline.

### Live (`DEMO_MODE=live`)

Real `@pincerpay/agent` SDK calling a real Express merchant server, with actual on-chain USDC settlement on Solana devnet.

```bash
cp .env.example .env.local
# Fill in AGENT_SOLANA_KEY, MERCHANT_ADDRESS, FACILITATOR_URL
DEMO_MODE=live npm run dev:live
```

## CLI Demo

Terminal-based walkthrough with spinners and colored output:

```bash
# Interactive — choose endpoints one at a time
npm run demo:cli

# Run all 4 endpoints sequentially
npm run demo:cli -- --all
```

## Talking Points

Use these when demoing PincerPay or presenting the agent payment story.

### The Problem

> "AI agents are great at calling APIs. But when those APIs cost money, there's no good way for an agent to pay. Today you either pre-purchase credits, hardcode API keys with billing attached, or build custom payment logic per provider. None of these scale to a world where agents call hundreds of different paid APIs autonomously."

### The x402 Solution

> "x402 turns payments into an HTTP-native concern. When an agent hits a paid endpoint, the server returns HTTP 402 — the same status code the web has reserved for payments since 1999 but never used. The 402 response includes exactly what to pay: amount, token, chain, and where to send it. The agent signs the payment, attaches proof, and retries. The server verifies and delivers the data."

> "This is like how 401 Unauthorized works for auth — but for money. The agent doesn't need to know anything about the merchant's billing system. It just needs a wallet."

### Why PincerPay

> "PincerPay is the infrastructure that makes x402 work in production. Three pieces:"
>
> 1. **Merchant SDK** — One middleware to add x402 pricing to any API endpoint. `app.get('/api/weather', pay('0.001'), handler)`.
> 2. **Agent SDK** — One wrapper around fetch. `agent.fetch(url)` handles 402 challenges automatically.
> 3. **Facilitator** — Verifies payment signatures and settles on-chain. Merchants don't touch crypto directly.

### Why Not Cards?

> "Card rails charge ~3% per transaction and settle in 1-3 days. For a $0.001 micropayment, the fee would be 30x the payment itself. USDC on Solana settles in 400ms for fractions of a cent. And there's no PCI compliance burden — no card numbers, no sensitive data."

### The Spending Policy Story

> "Agents with wallets need guardrails. PincerPay's agent SDK enforces spending policies — per-request caps and daily budgets — before the agent ever signs a payment. If a malicious API tries to charge $100 for weather data, the agent just says no. This is how you give an agent a credit card without giving it an unlimited credit card."

### The Bigger Picture

> "We think agent-to-agent payments are a trillion-dollar infrastructure layer. Today it's agents paying for APIs. Tomorrow it's agents hiring other agents, agents bidding on compute, agents settling contracts — all with instant USDC settlement, no human in the loop. PincerPay is the payment rail for that economy."

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   └── playground/
│   │       ├── page.tsx             # Interactive playground
│   │       └── actions.ts           # Server action (sim or live)
│   ├── components/
│   │   ├── agent-config.tsx         # Wallet + spending policy config
│   │   ├── endpoint-picker.tsx      # API endpoint browser
│   │   ├── flow-visualizer.tsx      # Step-by-step flow animation
│   │   ├── response-panel.tsx       # API response display
│   │   └── spend-tracker.tsx        # Budget usage tracker
│   └── lib/
│       ├── types.ts                 # Shared TypeScript types
│       ├── demo-endpoints.ts        # Mock endpoint definitions
│       ├── simulate.ts              # Simulation engine
│       └── execute-live.ts          # Live mode execution
├── server/
│   └── merchant.ts                  # Express merchant (live mode)
├── cli/
│   └── demo.ts                      # CLI demo script
└── package.json
```

## Tech Stack

- **Next.js 15** + Tailwind CSS v4 + TypeScript
- **Simulation engine** — Async step generator with realistic timing
- **chalk** + **ora** for CLI output
- **@pincerpay/agent** + **@pincerpay/merchant** (optional, for live mode)

## How PincerPay Works

PincerPay is an on-chain payment gateway for the agentic economy built on the **x402 protocol** (by Coinbase, 5,400+ GitHub stars).

**For merchants**: Add a middleware to your API. One line per endpoint sets the price. PincerPay handles verification and settlement.

```typescript
app.get("/api/weather", pay("0.001"), (req, res) => {
  res.json({ temp: 68, conditions: "Sunny" });
});
```

**For agents**: Wrap your fetch. PincerPay handles 402 challenges, payment signing, and retry.

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY,
});

const data = await agent.fetch("https://api.example.com/weather");
```

**Settlement**: USDC on Solana (primary), Base, or Polygon. No card rails. No 3% fees. Instant finality.

## Links

- [Live Demo](https://demo.pincerpay.com) — Try the playground and guided tour
- [PincerPay](https://pincerpay.com) — Main project + merchant dashboard
- [x402 Protocol](https://github.com/coinbase/x402) — HTTP 402 payment standard by Coinbase
- [Solana](https://solana.com) — Primary settlement chain
