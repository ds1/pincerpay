---
title: "Onboarding Functions"
description: "Implementation guide to @pincerpay/onboarding — non-custodial wallet generation, one-call merchant bootstrap, and API key minting against your own database."
order: 3.9
section: SDK Guides
---

`@pincerpay/onboarding` is the programmatic version of what the `pincerpay` CLI does: generate non-custodial wallets, create a merchant row, and mint an API key — all against a database you control. It's for building your own signup flow or admin tooling. This guide covers each exported function and the non-custodial contract you're responsible for upholding.

> **ESM-only.** The wallet generator runs anywhere Node crypto does; the merchant/key functions are **server-side** and open a Postgres connection. Three entry points: `@pincerpay/onboarding` (everything), `@pincerpay/onboarding/wallets`, and `@pincerpay/onboarding/merchant`.

## `generateMerchantWallets(options?)` — local, non-custodial keys

```ts
import { generateMerchantWallets } from "@pincerpay/onboarding";

const wallets = await generateMerchantWallets();       // 12-word mnemonic (strength: 128)
const big = await generateMerchantWallets({ strength: 256 }); // 24 words
const restored = await generateMerchantWallets({ mnemonic }); // re-derive from an existing phrase
```

Returns a `MerchantWallets`:

```ts
interface MerchantWallets {
  mnemonic: string;                 // BIP-39 phrase
  solana: ChainWallet;              // { address, privateKey (bs58), derivationPath }
  evm: ChainWallet;                 // { address, privateKey (0x-hex), derivationPath }
}
```

It derives a Solana key at `m/44'/501'/0'/0'` (Phantom-compatible) and an EVM key at `m/44'/60'/0'/0/0` (MetaMask-compatible) — both exported as `SOLANA_DERIVATION_PATH` / `EVM_DERIVATION_PATH`. A supplied `mnemonic` must be valid BIP-39 or it throws `"Invalid BIP-39 mnemonic"`; a degenerate EVM derivation throws `"EVM derivation produced no private key"`.

> **Non-custodial contract.** This function returns the mnemonic and private keys to *you* and PincerPay never sees them. That's the whole point — and the responsibility. Display them once to the merchant, let them save the phrase, and discard from memory. Don't log them, don't persist them server-side. Only public addresses should ever leave the process.

## `bootstrapMerchant(options)` — zero to merchant in one call

The end-to-end path: take (or generate) wallets, insert the merchant, mint a live API key, return env-ready output.

```ts
import { generateMerchantWallets, bootstrapMerchant } from "@pincerpay/onboarding";

const wallets = await generateMerchantWallets();
const result = await bootstrapMerchant({
  databaseUrl: process.env.DATABASE_URL!,
  name: "Acme Co",
  authUserId: supabaseUserId,
  wallets,
  supportedChains: ["solana", "polygon"],
  webhookUrlLive: "https://acme.example/webhooks",
});
// result: { merchantId, walletsGenerated, wallets?, apiKey: { rawKey, prefix, label }, webhookSecret }
```

Defaults worth knowing: `walletAddress` falls back to `wallets.solana.address`; `walletAddresses` defaults to `{ solana, evm }`; `supportedChains` defaults to `["solana", "polygon"]` when wallets are present (else `[]`); `apiKeyLabel` defaults to `"Bootstrap"`. The API key is always minted in the **`live`** environment. A live webhook secret (random 32-byte hex) is always generated; a test secret only if you pass `webhookUrlTest`.

You must supply **either** generated `wallets` **or** an explicit `walletAddress` — neither throws `"bootstrapMerchant: must provide either generated wallets or an explicit walletAddress"`. The function opens a DB connection via `createDb` and always `close()`s it in a `finally`, so you don't manage the pool. The returned `apiKey.rawKey` is shown **once** — surface it immediately; it isn't recoverable.

## `createApiKey(options)` — mint a key for an existing merchant

```ts
import { createApiKey } from "@pincerpay/onboarding";

const key = await createApiKey({
  databaseUrl: process.env.DATABASE_URL!,
  merchant: "Acme Co",        // UUID, or case-insensitive name
  label: "production",        // default "CLI"
  environment: "live",        // default "live"; "test" | "live"
});
// → { rawKey, prefix, label, merchantId, merchantName, environment }
```

`merchant` is resolved as a UUID first, then by case-insensitive name. Ambiguity and misses throw clear errors: `No merchant found with id ...`, `No merchant found with name "..."`, or `Name "..." matched multiple merchants. Pass --merchant <id> instead.` A **test** key cannot settle on a mainnet chain — mint `live` for production traffic. Like bootstrap, this hashes the key through the shared `@pincerpay/db` helpers, so set `TOKEN_PEPPER` in the environment to get HMAC-hashed keys (see the [Database & key hashing guide](/docs/guide-db)).

## `listMerchantsAll(databaseUrl)` — admin lookup

```ts
const merchants = await listMerchantsAll(process.env.DATABASE_URL!);
// → ListedMerchant[]  ({ id, name, authUserId }), ordered by createdAt
```

A thin admin helper for resolving which merchant is which before minting keys. Opens and closes its own connection.

## Putting it together

```ts
const wallets = await generateMerchantWallets();
// → show wallets.mnemonic to the merchant, have them confirm they saved it
const { merchantId, apiKey } = await bootstrapMerchant({
  databaseUrl, name, authUserId, wallets, supportedChains: ["solana"],
});
console.log("Save this key now, it won't be shown again:", apiKey.rawKey);
```

> **Heads-up on key hashing:** because these functions mint keys, the runtime that calls them must share the **same `TOKEN_PEPPER`** as the facilitator, or the keys won't authenticate. With no pepper set they fall back to legacy SHA-256 (still usable). Details in the [Database & key hashing guide](/docs/guide-db).
