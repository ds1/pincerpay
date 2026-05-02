---
"@pincerpay/onboarding": minor
"@pincerpay/mcp": minor
"@pincerpay/db": patch
---

S12: non-custodial merchant wallet bootstrap.

New package `@pincerpay/onboarding`:

- `generateMerchantWallets()` — one BIP-39 mnemonic, derives Solana (Phantom-compatible m/44'/501'/0'/0') and EVM (MetaMask-compatible m/44'/60'/0'/0/0) addresses + private keys.
- `bootstrapMerchant()` — end-to-end onboarding helper. Generates wallets, inserts a merchant row, mints an API key, returns env-var-ready config. Non-custodial: PincerPay never persists private material.
- `createApiKey()` / `listMerchantsAll()` — admin helpers. UUID or case-insensitive name lookup.

`@pincerpay/mcp` adds 4 onboarding tools:

- `bootstrap-wallets` — pure client-side crypto, available to all MCP clients.
- `bootstrap-merchant`, `create-api-key`, `list-merchants` — gated on `DATABASE_URL` env var. Return helpful errors directing public users to dashboard signup; only active in self-hosted / admin contexts.

Companion CLI scripts in the repo root (not published): `pnpm create-wallets`, `pnpm create-api-key`, `pnpm bootstrap-merchant`. Use these against `DATABASE_URL` to provision merchants without dashboard click-through.

`@pincerpay/db` is now publishable (initial publish at 0.1.1) so that `@pincerpay/onboarding`'s workspace dependency on it resolves cleanly for npm consumers. The package contains only Drizzle schema definitions; nothing sensitive.
