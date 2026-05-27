---
title: "Agent SDK Functions"
description: "Implementation guide to @pincerpay/agent: why create() exists, how fetch() handles 402s, and exactly what the spending policy does (and doesn't) enforce."
order: 3.7
section: SDK Guides
---

`@pincerpay/agent` gives an AI agent a wallet and a drop-in `fetch()` that pays for `402 Payment Required` resources automatically. The whole public surface is one class, `PincerPayAgent`, but a few of its methods have sharp edges worth understanding before you ship. This guide goes method by method.

> **ESM-only**, single entry point. `import { PincerPayAgent } from "@pincerpay/agent"`. The type re-exports `AgentConfig`, `SpendingPolicy`, `AgentStatus`, and `AgentProfile` come from `@pincerpay/core`.

## Construction: prefer `create()` over `new`

There are two ways to instantiate, and the difference matters:

```ts
// Async factory: ALWAYS use this when a Solana key is involved.
const agent = await PincerPayAgent.create({
  chains: ["solana"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!, // base58 keypair
});

// Synchronous constructor: EVM-only, registers the EVM scheme inline.
const evmAgent = new PincerPayAgent({
  chains: ["base"],
  evmPrivateKey: process.env.AGENT_EVM_KEY!,        // 0x-prefixed hex
});
```

The constructor is synchronous and **only registers the EVM payment scheme**. Solana key derivation is asynchronous (base58 decode, then `createKeyPairSignerFromBytes`), so it only happens in the static `create()` factory. If you call `new PincerPayAgent({ solanaPrivateKey })`, the Solana scheme is never wired up and `agent.solanaAddress` stays `undefined`, so payments on Solana will silently fail to sign. The rule of thumb is simple: always `await PincerPayAgent.create(...)`. It works for EVM-only too, so you can standardize on it.

Both forms require at least one key. With neither `evmPrivateKey` nor `solanaPrivateKey`, construction throws `"At least one wallet key (evmPrivateKey or solanaPrivateKey) is required"`. `AgentConfig` also takes `chains: string[]`, optional `policies: SpendingPolicy[]`, and an optional `facilitatorUrl` (defaults to production).

## `fetch(url, init?)`: the whole point

```ts
const res = await agent.fetch("https://api.example.com/weather");
const data = await res.json();
```

`fetch` mirrors the standard `fetch` signature (`string | URL`, optional `RequestInit`) and returns a normal `Response`. Under the hood it wraps the global fetch via `@x402/fetch`: when the server replies `402`, the SDK constructs and signs a USDC payment, submits it to the facilitator, and retries the original request, all transparently. Your code only ever sees the final `200` (or a non-payment error). Spending-policy hooks fire during this flow, and if a policy blocks the payment the attempt aborts and the policy's `reason` surfaces.

## Spending policies: what they actually enforce

This is the most important caveat in the package. A `SpendingPolicy` (from `@pincerpay/core`) has four fields (`maxPerTransaction`, `maxPerDay`, `allowedMerchants`, `allowedChains`), but the agent's runtime check **only enforces the two amount limits**:

```ts
const check = agent.checkPolicy("500000"); // 0.50 USDC, in BASE UNITS
// → { allowed: boolean, reason?: string }
```

`checkPolicy` compares the base-unit amount against `maxPerTransaction` and the running daily total against `maxPerDay`. **`allowedMerchants` and `allowedChains` are part of the type and schema but are NOT enforced here**, so do not rely on them as a security boundary in the SDK; gate those at your application layer. With no policies set, `checkPolicy` returns `{ allowed: true }`.

Amounts are **base-unit strings** parsed to `BigInt`. Passing `"0.50"` will throw at runtime because `BigInt("0.50")` is invalid, so use `"500000"`.

### Managing policy at runtime

```ts
agent.setPolicy({ maxPerTransaction: "1000000", maxPerDay: "10000000" }); // replaces ALL policies, resets daily tally
agent.getPolicy();        // → the first SpendingPolicy | undefined
agent.recordSpend("500000"); // add to today's tally
agent.getDailySpend();    // → { date: "YYYY-MM-DD" (UTC), amount: bigint }
```

`setPolicy` **replaces** the entire policy list with the single policy you pass and clears daily tracking; it is not a merge. The daily window is keyed by the **UTC** calendar date and resets at midnight UTC. Spend tracking is **in-memory only**, so it resets when the process restarts, and a long-lived daily cap needs your own persistence if the agent process is ephemeral.

## Wallet inspection

```ts
agent.evmAddress;    // string | undefined  (derived from evmPrivateKey)
agent.solanaAddress; // string | undefined  (only set when created via create())
agent.chains;        // string[]            (echoes config.chains)
```

## A complete, safe setup

```ts
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["solana", "base"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  evmPrivateKey: process.env.AGENT_EVM_KEY!,
  policies: [{ maxPerTransaction: "1000000", maxPerDay: "10000000" }], // base units
});

const res = await agent.fetch("https://api.example.com/paid-endpoint");
```

> **Never put agent keys in client-side code.** These keys spend real USDC, so keep them server-side. See the [Agent SDK overview](/docs/agent-sdk) for the conceptual flow and the [Core guide](/docs/guide-core) for the base-units rule.
