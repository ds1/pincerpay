# Phase S1: Solana Parity

**Date:** 2026-02-16
**Status:** Complete

## Objective
Make Solana the primary settlement chain. EVM becomes optional compatibility layer.

## Implementation Steps

- [x] Fix confirmation worker for Solana (WebSocket + `getSignatureStatuses`)
- [x] Add `gasToken`, `slot`, `priorityFee`, `computeUnits` columns to transactions schema
- [x] Flip defaults: `SOLANA_PRIVATE_KEY` required, EVM optional
- [x] Change `resolveRouteChains` default from `["base"]` to `["solana"]`
- [x] Dashboard: Solana explorer links, gas token display, slot/compute info
- [x] Update core types (Transaction interface, SolanaConfirmationLevel)
- [x] Update settle route to record gasToken per chain namespace
- [x] Update tests for new defaults (56 unique tests pass)
- [x] Build + typecheck clean (all 10 turbo tasks pass)

## Files Modified

| File | Change |
|---|---|
| `apps/facilitator/src/workers/confirmation.ts` | Full rewrite: EVM + Solana dual confirmation |
| `apps/facilitator/src/config.ts` | SOLANA_PRIVATE_KEY required, EVM optional |
| `apps/facilitator/src/index.ts` | Solana registered first, EVM conditional |
| `apps/facilitator/src/routes/settle.ts` | Records gasToken per chain namespace |
| `packages/core/src/types/index.ts` | Transaction: +gasToken/slot/priorityFee/computeUnits, +SolanaConfirmationLevel |
| `packages/db/src/schema/transactions.ts` | +gas_token, +slot, +priority_fee, +compute_units columns |
| `packages/merchant/src/client.ts` | Default chain: solana |
| `packages/merchant/src/middleware/hono.ts` | Default chain: solana |
| `packages/merchant/src/middleware/express.ts` | Default chain: solana |
| `apps/dashboard/src/app/dashboard/transactions/[id]/page.tsx` | Solana explorer links, gasToken display |
| `packages/core/src/__tests__/chains.test.ts` | Solana CAIP-2 + property tests |
| `packages/merchant/src/__tests__/client.test.ts` | Default chain → solana, Solana USDC test |
