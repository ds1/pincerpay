# @pincerpay/onboarding

[![npm](https://img.shields.io/npm/v/@pincerpay/onboarding?style=flat-square)](https://www.npmjs.com/package/@pincerpay/onboarding)
[![license](https://img.shields.io/npm/l/@pincerpay/onboarding?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Non-custodial merchant onboarding utilities for [PincerPay](https://pincerpay.com). Generate wallets, create merchant records, provision API keys — without dashboard click-through.

## Why this package

The fastest path from zero to a working PincerPay merchant takes a single command. This package is the engine: BIP-39 wallet generation that's Phantom + MetaMask compatible, plus DB helpers that mint merchant rows and API keys.

It's used by:

- The PincerPay CLI scripts (`pnpm bootstrap-merchant`, `pnpm create-wallets`, `pnpm create-api-key`)
- The `@pincerpay/mcp` server's onboarding tools (`bootstrap-wallets`, `bootstrap-merchant`, `create-api-key`, `list-merchants`)
- Any custom signup flow you build

## Install

```bash
npm install @pincerpay/onboarding
```

## Security model

PincerPay never sees your mnemonic or private keys. This package generates everything client-side:

- BIP-39 mnemonic generated locally with `@scure/bip39` (audited)
- Solana keys derived via `ed25519-hd-key` at the Phantom-standard path `m/44'/501'/0'/0'`
- EVM keys derived via `@scure/bip32` at the MetaMask-standard path `m/44'/60'/0'/0/0`
- The merchant database persists only public addresses

If you lose the mnemonic, any USDC sent to those addresses is unrecoverable. PincerPay cannot recover it. Treat the mnemonic like the seed it is.

## Quick Start

### Generate wallets

```typescript
import { generateMerchantWallets } from "@pincerpay/onboarding";

const wallets = await generateMerchantWallets();

console.log(wallets.mnemonic);          // 12-word BIP-39 seed phrase
console.log(wallets.solana.address);    // base58 (Phantom-compatible)
console.log(wallets.evm.address);       // 0x... (MetaMask-compatible)
```

### Re-derive from an existing mnemonic

```typescript
const wallets = await generateMerchantWallets({
  mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
});
// Same mnemonic always produces the same addresses.
```

### End-to-end merchant bootstrap

```typescript
import { generateMerchantWallets, bootstrapMerchant } from "@pincerpay/onboarding";

const wallets = await generateMerchantWallets();

const result = await bootstrapMerchant({
  databaseUrl: process.env.DATABASE_URL!,
  name: "My Merchant",
  authUserId: "<supabase-auth-user-uuid>",
  wallets,
  walletAddresses: { solana: wallets.solana.address, evm: wallets.evm.address },
  supportedChains: ["solana", "polygon"],
  apiKeyLabel: "Production",
});

// result.merchantId      — new merchant row id
// result.apiKey.rawKey   — pp_live_... — saved once, never recoverable
// result.webhookSecret   — HMAC-SHA256 hex secret
// result.wallets         — the wallets you passed in (for display)
```

### Mint a key for an existing merchant

```typescript
import { createApiKey } from "@pincerpay/onboarding";

const result = await createApiKey({
  databaseUrl: process.env.DATABASE_URL!,
  merchant: "Fools",                  // UUID or case-insensitive name
  label: "Fools staging",
});

console.log(result.rawKey);           // pp_live_...
```

## API Reference

### `generateMerchantWallets(options?)`

Pure client-side crypto. Generates a BIP-39 mnemonic plus Solana + EVM accounts derived from it.

```typescript
interface GenerateOptions {
  /** 12 (default) or 24 words */
  strength?: 128 | 256;
  /** Use a specific mnemonic instead of generating */
  mnemonic?: string;
}

interface MerchantWallets {
  mnemonic: string;
  solana: ChainWallet;
  evm: ChainWallet;
}

interface ChainWallet {
  address: string;
  privateKey: string;     // Solana: base58 (64 bytes). EVM: 0x-prefixed hex.
  derivationPath: string;
}
```

### `bootstrapMerchant(options)`

End-to-end merchant onboarding. Inserts a merchant row, mints an API key, returns everything needed to print env-var-ready output. Requires `DATABASE_URL`.

```typescript
interface BootstrapOptions {
  databaseUrl: string;
  name: string;
  authUserId: string;
  wallets?: MerchantWallets;        // Or supply walletAddress/walletAddresses directly
  walletAddress?: string;
  walletAddresses?: Record<string, string>;
  supportedChains?: string[];
  webhookUrl?: string;
  apiKeyLabel?: string;
}

interface BootstrapResult {
  merchantId: string;
  walletsGenerated: boolean;
  wallets?: MerchantWallets;        // Returned ONCE; caller must display + discard
  apiKey: { rawKey: string; prefix: string; label: string };
  webhookSecret: string;
}
```

### `createApiKey(options)`

Mint a new API key for an existing merchant. Resolves merchants by UUID or case-insensitive name.

```typescript
interface CreateApiKeyOptions {
  databaseUrl: string;
  merchant: string;     // UUID or name
  label?: string;
}
```

### `listMerchantsAll(databaseUrl)`

Admin listing of all merchants.

## Derivation paths

| Chain  | Path                | Wallet compatibility       |
|--------|---------------------|----------------------------|
| Solana | `m/44'/501'/0'/0'`  | Phantom, Solflare, Backpack |
| EVM    | `m/44'/60'/0'/0/0`  | MetaMask, Rabby, Frame     |

Importing the mnemonic into either wallet will surface the same addresses.

## CLI usage

If you've cloned the PincerPay repo, three commands wrap this package:

```bash
DATABASE_URL=postgresql://... pnpm bootstrap-merchant --name "X" --auth-user-id <uuid>
DATABASE_URL=postgresql://... pnpm create-api-key list
DATABASE_URL=postgresql://... pnpm create-api-key create --merchant Fools --label "Production"
pnpm create-wallets                                  # No DB needed
```

## MCP usage

The `@pincerpay/mcp` server exposes four onboarding tools:

| Tool                | Auth required           |
|---------------------|-------------------------|
| `bootstrap-wallets` | None (pure crypto)      |
| `bootstrap-merchant`| `DATABASE_URL` env var  |
| `create-api-key`    | `DATABASE_URL` env var  |
| `list-merchants`    | `DATABASE_URL` env var  |

Public MCP clients (running `npx @pincerpay/mcp`) get `bootstrap-wallets` only. The DB-backed tools return helpful errors directing users to dashboard signup. Self-hosted / admin contexts that set `DATABASE_URL` get the full set.

## License

MIT
