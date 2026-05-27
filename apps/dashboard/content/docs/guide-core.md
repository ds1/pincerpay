---
title: "Core: Chains, Addresses & Config"
description: "A function-by-function guide to @pincerpay/core — chain resolution, address validation, config schemas, and the base-units rule that trips everyone up."
order: 3.6
section: SDK Guides
---

`@pincerpay/core` is the shared foundation every other PincerPay package builds on. You rarely install it alone, but understanding its functions explains how chains are named, how addresses are validated, and — most importantly — the one unit convention that causes the majority of integration bugs. This guide walks each public function in the order you'll actually meet them.

> **ESM-only.** Like every PincerPay package, `@pincerpay/core` ships ESM only. Your project needs `"type": "module"` and `.js` import specifiers.

## The base-units rule (read this first)

USDC has **6 decimals**. Two different conventions coexist in the API, and mixing them up is the #1 source of "why did my agent pay 1,000,000 USDC" bugs:

- **Base units** — integer strings where `"1000000"` = 1 USDC. Used by `Transaction.amount`, `SpendingPolicy.maxPerTransaction`/`maxPerDay`, and the agent's `checkPolicy`/`recordSpend`.
- **Human decimals** — strings like `"0.01"`. Used only by paywall `price` fields (`RoutePaywallConfig`).

`USDC_DECIMALS` (6) and `OPTIMISTIC_THRESHOLD` (`"1000000"`, the sub-1-USDC fast-release cutoff) are exported constants. When in doubt, you're probably in base units — only route pricing is human-readable, and `@pincerpay/merchant`'s `toBaseUnits` converts that for you.

## Resolving chains

PincerPay identifies chains two ways: short names (`solana`, `base`, `polygon`, `solana-devnet`, `base-sepolia`, `polygon-amoy`) and [CAIP-2](/docs/chain-architecture) IDs. Two functions bridge them, and they fail differently on purpose:

```ts
import { resolveChain, toCAIP2 } from "@pincerpay/core";

resolveChain("solana");        // → ChainConfig | undefined  (never throws)
resolveChain("eip155:8453");   // → ChainConfig (accepts CAIP-2 too)
resolveChain("dogecoin");      // → undefined

toCAIP2("base");               // → "eip155:8453"
toCAIP2("dogecoin");           // throws: Unknown chain: "dogecoin". Valid chains: ...
```

Use `resolveChain` when an unknown chain is an expected, recoverable case (you'll branch on `undefined`). Use `toCAIP2` at trust boundaries where an unknown chain is a programming error you want surfaced loudly. `getMainnetChains()` and `getTestnetChains()` return the `ChainConfig[]` for each environment — handy for building selectors or validating that a test key isn't pointed at mainnet.

Each `ChainConfig` carries the chain's CAIP-2 ID, namespace, and USDC contract address, so you rarely hard-code an address yourself.

## Validating addresses

These are **format** checks, not on-chain existence or checksum checks — cheap guards for user input before you hand an address to the facilitator:

```ts
import { isValidSolanaAddress, isValidEvmAddress } from "@pincerpay/core";

isValidSolanaAddress("11111111111111111111111111111111"); // base58, 32–44 chars
isValidEvmAddress("0xab...40hex");                          // 0x + 40 hex, case-insensitive
```

`isValidEvmAddress` does **not** enforce EIP-55 checksum casing, and `isValidSolanaAddress` does **not** verify the key is on-curve or a real mint — treat them as "looks plausible," not "is valid and exists."

For the chain-aware version, use `getChainNamespace(shorthand)` (returns `"eip155"` or `"solana"`, **throws** on unknown chain) and `validateMerchantAddressForChain(address, shorthand)`, which returns `null` on success or a **human-readable error string** on failure:

```ts
const err = validateMerchantAddressForChain(addr, "polygon");
if (err) return res.status(400).json({ error: err }); // err is already a sentence
```

## Picking the right merchant address

Merchants can configure a single `merchantAddress` or a per-chain `merchantAddresses` map. `resolveMerchantAddress` encodes the precedence so every package resolves identically:

```ts
resolveMerchantAddress({ merchantAddress, merchantAddresses }, "solana");
// 1. merchantAddresses["solana"]  (case-insensitive key match)
// 2. merchantAddress              (legacy single fallback)
// 3. undefined
```

This is the exact logic the merchant middleware runs at startup, so calling it yourself is a good pre-flight check that every chain you intend to serve actually has a wallet.

## Config schemas (Zod)

`@pincerpay/core` exports the Zod schemas the SDKs validate against. They live alongside the types and are worth using directly if you build your own config layer:

- `PincerPayConfigSchema` — validates a merchant config. Its `.refine()` requires **either** `merchantAddress` **or** a non-empty `merchantAddresses` (error reported on the `merchantAddresses` path), and `facilitatorUrl` must be a valid URL when present.
- `RoutePaywallConfigSchema` — `price` must match `^\d+\.?\d*$` (a human USDC decimal string like `"0.01"`); `chain`, `chains`, and `description` are optional.
- `SpendingPolicySchema` — all fields optional; the limit fields are base-unit strings.

```ts
import { PincerPayConfigSchema } from "@pincerpay/core";
const config = PincerPayConfigSchema.parse(rawConfig); // throws ZodError with a path you can surface
```

## Constants worth knowing

`DEFAULT_FACILITATOR_URL` (`https://facilitator.pincerpay.com`), `API_KEY_HEADER` (`x-pincerpay-api-key`), `API_KEY_LIVE_PREFIX`/`API_KEY_TEST_PREFIX` (`pp_live_`/`pp_test_`), `API_KEY_PREFIX_LENGTH` (12), and `FACILITATOR_ROUTES` (the canonical path map) mean you never have to string-build a facilitator URL or guess a header name.

## Where next

These primitives power the [Merchant SDK guide](/docs/guide-merchant) (which calls `resolveChain`, `resolveMerchantAddress`, and `validateMerchantAddressForChain` at startup) and the [Agent SDK guide](/docs/guide-agent) (which consumes `SpendingPolicy` and base-unit amounts).
