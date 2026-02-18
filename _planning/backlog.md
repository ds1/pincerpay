# Backlog

Last updated: 2026-02-18

## Completed

- [x] **Phase 1 (MVP)** — x402 facilitator + multi-chain USDC + merchant dashboard. Deployed to Railway + Vercel.
- [x] **Phase S1 (Solana Parity)** — Solana-first defaults, confirmation worker, gas tracking, dashboard Solana support.
- [x] **Phase S2 (Kora + Squads)** — Code complete. Kora gasless signer, Squads Smart Account agent SDK, agents DB table, dashboard agent management.
- [x] **Phase S3 (On-Chain Anchor)** — Code complete. Anchor program (5 instructions), TS client, hybrid facilitator, settle-direct route, on-chain recorder worker.
- [x] **Agent Demo** — Standalone demo repo at `pincerpay-agent-demo`. Web playground + CLI demo.

## High Priority — Deploy S2 + S3

### S2 Infrastructure Deployment
- [ ] Deploy Kora signer node on Railway as separate service
- [ ] Fund Kora fee payer wallet with SOL + USDC on devnet
- [ ] Set `KORA_RPC_URL` + `KORA_API_KEY` env vars on Railway facilitator
- [ ] Push DB schema to Supabase (`pnpm db:push`) — includes `agents` table + `transactions.agent_id`
- [ ] Re-enable RLS on all tables (including new `agents` table)
- [ ] Set `CORS_ORIGINS=https://pincerpay.com,https://www.pincerpay.com` on Railway
- [ ] Add CNAME `facilitator` → `pincerpayfacilitator-production.up.railway.app` in Vercel DNS
- [ ] Configure custom domain `facilitator.pincerpay.com` on Railway

### S3 Infrastructure Deployment
- [ ] Install Anchor CLI in WSL2 (or rely on CI workflow)
- [ ] Run `anchor build` to generate real IDL + .so binary
- [ ] Deploy Anchor program to Solana devnet (`anchor deploy --provider.cluster devnet`)
- [ ] Update `PINCERPAY_PROGRAM_ID` in code with deployed program address
- [ ] Set `ANCHOR_PROGRAM_ID` env var on Railway facilitator
- [ ] Register test merchant on-chain via program client
- [ ] Push DB schema changes (`settlement_type`, `program_nonce`, `on_chain_registered`, `merchant_pda`)

### Production Hardening
- [ ] End-to-end payment test: agent → merchant paywall → facilitator → Solana devnet settlement
- [ ] Monitoring + alerting for facilitator (uptime, error rate, settlement latency)
- [ ] Rate limiting tuning for production traffic
- [ ] Facilitator graceful shutdown validation under load
- [ ] Webhook delivery retry logic (exponential backoff, dead letter queue)

## Medium Priority — Phase S4: Transfer Hooks + Compliance

- [ ] Separate Anchor compliance program (Transfer Hook authority)
- [ ] OFAC screening integration at Facilitator layer
- [ ] Compressed account screening for compliance
- [ ] Dashboard compliance audit log (view screened/blocked transactions)
- [ ] Merchant opt-in flow for Transfer Hook registration
- [ ] Compliance-as-a-Service pricing tier implementation

### Developer Experience
- [ ] Public documentation site (Docusaurus or similar)
- [ ] API reference docs (OpenAPI spec for facilitator routes)
- [ ] SDK quickstart guides (merchant + agent, Solana-first)
- [ ] Example: Next.js merchant with PincerPay paywall
- [ ] Example: AI agent with spending policies + Squads Smart Account
- [ ] npm publish pipeline for `@pincerpay/merchant`, `@pincerpay/agent`, `@pincerpay/solana`

### Dashboard Improvements
- [ ] Real-time transaction feed (WebSocket or polling)
- [ ] Webhook management UI (configure endpoints, view delivery logs)
- [ ] Multi-merchant support (team/org accounts)
- [ ] Export transactions (CSV/JSON)
- [ ] Merchant billing / usage dashboard

## Low Priority / Ideas — Phase S5+

### Phase S5: Advanced Features
- [ ] Micropayment batching with ZK compression (Solana)
- [ ] CCTP v2 EVM→Solana USDC bridging
- [ ] Solana Actions for human-approval flows (high-value txns)
- [ ] Agent identity: DIDs + on-chain trust scores (ERC-8004 / Solana equivalent)

### Protocol Integrations
- [ ] UCP manifest generator for merchants (`/.well-known/ucp`)
- [ ] AP2 mandate validation at facilitator (Double-Lock enforcement)
- [ ] A2A x402 Extension support (3-step agent message flow)
- [ ] MCP server for merchant management (AI-native admin)

### Growth / GTM
- [ ] Mainnet deployment (Solana mainnet-beta, Base mainnet)
- [ ] Landing page refresh (pincerpay.com — marketing site vs dashboard)
- [ ] Merchant onboarding email flow
- [ ] Analytics: agent behavior patterns, popular paywalls, settlement volume
- [ ] Partner integrations: AI agent frameworks (LangChain, CrewAI, AutoGen)
- [ ] Testnet faucet / sandbox mode for merchant developers
