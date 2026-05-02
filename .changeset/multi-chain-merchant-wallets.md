---
"@pincerpay/merchant": minor
"@pincerpay/core": minor
---

Multi-chain receiving wallets — the merchant SDK now accepts a per-chain wallet map.

`PincerPayConfig` gains an optional `merchantAddresses?: Record<string, string>` field keyed by chain shorthand (`solana`, `polygon`, `base`, etc.). The middleware resolves `payTo` per-route per-chain, with the per-chain map winning over the legacy single-string `merchantAddress` (which is now optional but still fully supported).

```ts
createPincerPayMiddleware({
  apiKey: process.env.PINCERPAY_API_KEY!,
  merchantAddresses: {
    solana:  process.env.MERCHANT_ADDRESS_SOLANA!,
    polygon: process.env.MERCHANT_ADDRESS_POLYGON!,
  },
  routes: {
    "POST /api/trade": { price: "0.05", chains: ["solana", "polygon"] },
  },
});
```

Format validation is fail-fast at middleware construction. A Solana base58 address under a `polygon` key (or vice versa) throws with a chain-named error like `Route "POST /api/trade" targets chain "polygon": address "GjsW..." is not a valid EVM address (expected /^0x[0-9a-fA-F]{40}$/).` — not at request time, not at settle time.

New exports from `@pincerpay/core`:
- `isValidSolanaAddress(s: string): boolean`
- `isValidEvmAddress(s: string): boolean`
- `validateMerchantAddressForChain(address, chainShorthand): string | null`
- `getChainNamespace(chainShorthand): "solana" | "eip155"`
- `resolveMerchantAddress(config, chainShorthand): string | undefined` — useful for testing ("which address would PincerPay actually use for chain X?")

**Backward compatibility.** Existing single-chain merchants with `merchantAddress: string` keep working unchanged. The legacy field is now optional in the type signature, but `PincerPayConfigSchema` enforces "at least one of `merchantAddress` or `merchantAddresses` must be set."

**Routing behavior.** Agents pay on whichever chain they hold USDC; PincerPay routes settlement to your registered wallet on that chain. No cross-chain conversion happens.

Dashboard UI for managing per-chain wallets is on the roadmap as Phase B of S1. The SDK ships first; merchants who configure via env vars (most production-bound integrations) can adopt today.
