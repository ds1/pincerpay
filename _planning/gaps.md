# PincerPay Gap Analysis

Last updated: 2026-02-16

## Critical (Fix Before Onboarding Merchants)

- [x] **1. Private key committed to repo** — DOWNGRADED: `.env` is properly `.gitignore`d and was never committed. Local-only, testnet key.
- [x] **2. CORS wide open** — Added production warning when `CORS_ORIGINS` unset. Manual step: set env var on Railway.
- [x] **3. `DEFAULT_FACILITATOR_URL` points to non-existent domain** — Merchant middleware now imports constant from `@pincerpay/core`. Manual step: set up CNAME `facilitator.pincerpay.com` → Railway.
- [x] **4. Agent spending policies not enforced** — Policies now enforced via `x402Client.onBeforePaymentCreation` / `onAfterPaymentCreation` hooks.
- [x] **5. Merchant SDK: no Solana scheme** — Added `@x402/svm` dep, registered `ExactSvmScheme` in both Express and Hono middleware.

## High (Operational Gaps)

- [x] **6. No webhook dispatch** — Auth middleware fetches `webhookUrl`, settle route POSTs transaction details after insert (fire-and-forget).
- [x] **7. Transaction status never updates** — Background confirmation worker polls chain every 15s, updates optimistic → confirmed/failed.
- [x] **8. Gas cost never tracked** — Confirmation worker extracts `gasUsed * effectiveGasPrice` from EVM receipts, stores in `gasCost` column (native wei). USDC conversion deferred.
- [x] **9. No pagination in dashboard** — Transactions + paywalls pages use offset/limit with Prev/Next controls.
- [ ] **10. Rate limiter is in-memory** — Deferred to Phase 2. Single-instance Railway is fine for testnet traffic.

## Medium (Missing Features)

- [ ] **11. No API key expiration or rotation policy** — Keys live forever unless manually revoked.
- [ ] **12. No paywall editing** — Must delete + recreate to change price/chains.
- [ ] **13. No transaction search/filtering** in dashboard.
- [ ] **14. No CSV export** for transactions (needed for accounting).
- [ ] **15. No real-time dashboard updates** — Must refresh page to see new transactions.
- [ ] **16. Daily spend tracking is in-memory only** — Agent can bypass daily limits by restarting.
- [ ] **17. No Dockerfile HEALTHCHECK** on facilitator.
- [ ] **18. No linting in CI** — Pipeline does typecheck → test → build, but no ESLint/Prettier.
- [ ] **19. No database migration strategy** — Using `db:push` (direct schema push), no migration files, no rollback.

## Observability (Zero)

- [ ] **20. No error tracking** (Sentry, Rollbar)
- [ ] **21. No metrics** (Prometheus, Datadog)
- [ ] **22. No alerting** (PagerDuty)
- [ ] **23. No distributed tracing** (OpenTelemetry)

## Documentation

- [ ] **24. No OpenAPI/Swagger spec** for facilitator endpoints.
- [ ] **25. No merchant onboarding guide** — examples exist but no walkthrough.
- [ ] **26. No agent developer guide** — spending policies undocumented.
- [ ] **27. Example apps default to localhost facilitator** and have no `.env.example`.

## Phase S2+ (Tracked, Not Started — Solana-First)

- [ ] Kora gasless Solana txns (agents pay fees in USDC, not SOL)
- [ ] Squads SPN session keys (Solana agent spending policies on-chain)
- [ ] On-chain Facilitator (Anchor program for Solana settlement)
- [ ] Transfer Hooks + OFAC compliance (Anchor compliance program)
- [ ] Micropayment batching (ZK compression on Solana)
- [ ] AP2 mandates
- [ ] UCP manifest
- [ ] Double-Lock (A2A x402 Extension)
- [ ] CCTP v2 EVM→Solana bridging
- [ ] Agent identity (DIDs + trust scores)
- [ ] ERC-7715 session keys (EVM optional)
- [ ] Escrow
- [ ] Fiat off-ramp
