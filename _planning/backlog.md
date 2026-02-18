# Backlog

Last updated: 2026-02-18

> **Source of truth:** [GitHub Issues](https://github.com/ds1/pincerpay/issues). This file is a local snapshot synced from issues. When completing work, close the GitHub Issue — this file gets regenerated from issue state.

## Completed

- [x] **Phase 1 (MVP)** — x402 facilitator + multi-chain USDC + merchant dashboard. Deployed to Railway + Vercel.
- [x] **Phase S1 (Solana Parity)** — Solana-first defaults, confirmation worker, gas tracking, dashboard Solana support.
- [x] **Phase S2 (Kora + Squads)** — Code complete. Kora gasless signer, Squads Smart Account agent SDK, agents DB table, dashboard agent management.
- [x] **Phase S3 (On-Chain Anchor)** — Code complete. Anchor program (5 instructions), TS client, hybrid facilitator, settle-direct route, on-chain recorder worker.
- [x] **Agent Demo** — Standalone demo repo at `pincerpay-agent-demo`. Web playground + CLI demo.

---

## High Priority — Deploy S2 + S3

### S2 Infrastructure Deployment
- [ ] #1 Deploy Kora signer node on Railway
- [ ] #2 Fund Kora fee payer wallet on devnet
- [ ] #3 Set Kora env vars on Railway facilitator
- [x] #4 Push S2 DB schema to Supabase + re-enable RLS
- [x] #5 Set CORS_ORIGINS on Railway facilitator
- [x] #6 Configure facilitator.pincerpay.com custom domain

### S3 Infrastructure Deployment
- [ ] #7 Build Anchor program (IDL + .so binary)
- [ ] #8 Deploy Anchor program to Solana devnet
- [ ] #9 Update PINCERPAY_PROGRAM_ID with deployed address
- [ ] #10 Set ANCHOR_PROGRAM_ID on Railway facilitator
- [ ] #11 Register test merchant on-chain via Anchor
- [x] #12 Push S3 DB schema changes + re-enable RLS

### Production Hardening
- [ ] #13 End-to-end payment test on devnet
- [ ] #14 Monitoring + alerting for facilitator
- [x] #15 Rate limiting tuning for production
- [ ] #16 Graceful shutdown validation under load
- [x] #17 Webhook delivery retry logic

---

## Medium Priority — Phase S4 + DevEx + Dashboard

### Compliance (Phase S4)
- [ ] #18 Anchor compliance program (Transfer Hook)
- [ ] #19 OFAC screening integration at Facilitator layer
- [ ] #20 Compressed account compliance screening
- [ ] #21 Dashboard compliance audit log
- [ ] #22 Merchant opt-in for Transfer Hook registration
- [ ] #23 Compliance-as-a-Service pricing tiers

### Developer Experience
- [ ] #24 Public documentation site (Docusaurus/Nextra)
- [ ] #25 API reference docs (OpenAPI spec)
- [ ] #26 SDK quickstart guides (merchant + agent)
- [ ] #27 Example: Next.js merchant with PincerPay paywall
- [ ] #28 Example: AI agent with spending policies + Squads
- [ ] #29 npm publish pipeline for @pincerpay packages

### Dashboard Improvements
- [ ] #30 Real-time transaction feed on dashboard
- [ ] #31 Webhook management UI
- [ ] #32 Multi-merchant / team support
- [ ] #33 Export transactions (CSV/JSON)
- [ ] #34 Merchant billing / usage dashboard

---

## Low Priority / Ideas — Phase S5+

### Phase S5: Advanced Features
- [ ] #35 Micropayment batching with ZK compression
- [ ] #36 CCTP v2 EVM→Solana USDC bridging
- [ ] #37 Solana Actions for human-approval flows
- [ ] #38 Agent identity: DIDs + on-chain trust scores

### Protocol Integrations
- [ ] #39 UCP manifest generator for merchants
- [ ] #40 AP2 mandate validation (Double-Lock)
- [ ] #41 A2A x402 Extension support (3-step flow)
- [ ] #42 MCP server for merchant management

### Growth / GTM
- [ ] #43 Mainnet deployment (Solana + Base)
- [ ] #44 Landing page refresh (marketing site)
- [ ] #45 Merchant onboarding email flow
- [ ] #46 Analytics: agent behavior patterns
- [ ] #47 Partner integrations: AI agent frameworks
- [ ] #48 Testnet faucet / sandbox mode
