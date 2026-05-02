---
"@pincerpay/mcp": patch
---

MCP tools updated for multi-chain merchant configs (S1 Phase A follow-through).

- `scaffold-x402-middleware` accepts an optional `merchantAddresses?: Record<string, string>` input and emits the corresponding `merchantAddresses: { ... }` config block. Single-chain behavior via `merchantAddress` is unchanged.
- `validate-payment-config` walks the resolved per-chain wallets for every route and surfaces missing-wallet and format-mismatch warnings with chain-named messages, mirroring the SDK's init-time validation.
- `docs://pincerpay/merchant` resource gains a "Multi-chain Receiving Wallets" section.

Backward-compatible. Existing single-chain inputs and configs are unaffected.
