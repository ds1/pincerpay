# Fix Solana-First Architecture Gaps

**Date:** 2026-02-17
**Status:** Complete
**Objective:** Align dashboard UI and test suite with the Solana-first architecture established in Phase S1.

## Context

Runtime code (facilitator, SDKs, core) is fully Solana-first. But the dashboard still only lists EVM chains and rejects Solana wallet addresses, and the test suite has no Solana coverage for the agent SDK or facilitator setup.

## Changes

### 1. Dashboard: Add Solana chains to merchant form
**File:** `apps/dashboard/src/app/dashboard/settings/merchant-form.tsx`
- [x] Replace `AVAILABLE_CHAINS` (lines 15-20) — add Solana + Solana Devnet as first two entries
- [x] Update wallet placeholder (line 54) from `"0x..."` to `"Solana or EVM wallet address"`

### 2. Dashboard: Accept Solana addresses in wallet validation
**File:** `apps/dashboard/src/app/dashboard/settings/actions.ts`
- [x] Replace EVM-only regex (lines 22-25) with dual validation:
  - EVM: `^0x[0-9a-fA-F]{40}$`
  - Solana: `^[1-9A-HJ-NP-Za-km-z]{32,44}$` (base58 alphabet, excludes 0/O/I/l)
- [x] Update error message to describe both formats

### 3. Dashboard: Update paywall form placeholder
**File:** `apps/dashboard/src/app/dashboard/paywalls/paywall-form.tsx`
- [x] Line 65: change placeholder from `"base, polygon"` to `"solana, base, polygon"`

### 4. Agent SDK: Add `solanaAddress` getter
**File:** `packages/agent/src/client.ts`
- [x] Add private `_solanaAddress?: string` field (after line 25)
- [x] In `create()` (line 69-70): capture `keypairSigner.address` after Solana scheme registration
- [x] Set `agent._solanaAddress = solanaAddress` before returning (line 73)
- [x] Add `get solanaAddress()` getter after `evmAddress` getter (line 142)

### 5. Agent SDK: Add Solana test coverage
**File:** `packages/agent/src/__tests__/client.test.ts`
- [x] Add `@scure/base` as devDependency in `packages/agent/package.json` (already in lockfile via facilitator)
- [x] Add new `describe("PincerPayAgent Solana support")` block with 4 tests:
  - Creates agent with Solana key via `PincerPayAgent.create()`
  - Creates dual-chain agent (EVM + Solana)
  - Enforces spending policies with Solana agent
  - Returns undefined `solanaAddress` when only EVM key provided
- [x] Generate test keypair in `beforeAll` using `crypto.subtle.generateKey("Ed25519", true, ...)` + base58 encode

### 6. Facilitator: Reduced-scope Solana setup test
**File:** `apps/facilitator/src/__tests__/e2e-solana.test.ts` (new)
- [x] Verify `setupSolanaFacilitator()` registers SVM scheme on the facilitator
- [x] Verify scheme appears in `facilitator.getSupported()` for the Solana devnet chain
- [x] Generate test keypair same way as agent tests
- [x] No mock RPC needed — just setup verification

## Dependency Changes

| Package | Change |
|---------|--------|
| `@pincerpay/agent` | Add `@scure/base: "^1.2.6"` to `devDependencies` |

## Verification

```bash
pnpm install              # pick up new devDependency
pnpm typecheck            # no type errors
pnpm test                 # all tests pass (existing + new)
pnpm build                # clean build
```
