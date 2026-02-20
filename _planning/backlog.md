# Backlog

Last updated: 2026-02-20

> **Source of truth:** [GitHub Issues](https://github.com/ds1/pincerpay/issues). This file is a local snapshot synced from issues. When completing work, close the GitHub Issue — this file gets regenerated from issue state.

## Completed

- [x] **Phase 1 (MVP)** — x402 facilitator + multi-chain USDC + merchant dashboard. Deployed to Railway + Vercel.
- [x] **Phase S1 (Solana Parity)** — Solana-first defaults, confirmation worker, gas tracking, dashboard Solana support.
- [x] **Phase S2 (Kora + Squads)** — Code complete. Kora gasless signer, Squads Smart Account agent SDK, agents DB table, dashboard agent management.
- [x] **Phase S3 (On-Chain Anchor)** — Code complete. Anchor program (5 instructions), TS client, hybrid facilitator, settle-direct route, on-chain recorder worker.
- [x] **Agent Demo** — Standalone demo repo at `pincerpay-agent-demo`. Web playground + CLI demo.
- [x] **MCP Server** — `@pincerpay/mcp` with 7 tools, 3 resources, 3 prompts, dual transport. 22 tests.
- [x] **Cost Optimization (v0.8.0)** — Adaptive worker polling, batched RPC, cached viem clients, worker nudge API.
- [x] #4 Push S2 DB schema to Supabase + re-enable RLS
- [x] #5 Set CORS_ORIGINS on Railway facilitator
- [x] #6 Configure facilitator.pincerpay.com custom domain
- [x] #7 Build Anchor program (IDL + .so binary)
- [x] #8 Deploy Anchor program to Solana devnet
- [x] #9 Update PINCERPAY_PROGRAM_ID with deployed address
- [x] #10 Set ANCHOR_PROGRAM_ID on Railway facilitator
- [x] #11 Register test merchant on-chain via Anchor
- [x] #12 Push S3 DB schema changes + re-enable RLS
- [x] #15 Rate limiting tuning for production
- [x] #17 Webhook delivery retry logic
- [x] #25 API reference docs (OpenAPI spec)
- [x] #29 npm publish pipeline for @pincerpay packages
- [x] #31 Webhook management UI
- [x] #33 Export transactions (CSV/JSON)
- [x] #39 UCP manifest generator for merchants
- [x] #42 MCP server for merchant management

---

## High Priority — Infrastructure + Distribution Tier 1

### S2 Infrastructure Deployment
- [ ] #1 Deploy Kora signer node on Railway
- [ ] #2 Fund Kora fee payer wallet on devnet
- [ ] #3 Set Kora env vars on Railway facilitator

### Production Hardening
- [ ] #13 End-to-end payment test on devnet
- [ ] #14 Monitoring + alerting for facilitator
- [ ] #16 Graceful shutdown validation under load

### Distribution — Tier 1 (Week 1-2)
- [ ] #49 Publish npm packages (@pincerpay/core, merchant, agent, mcp)
- [ ] #50 Cursor Rules (.cursor/rules/pincerpay.mdc)
- [ ] #51 llms.txt on pincerpay.com
- [ ] #52 README optimization (ReadMe.LLM patterns)
- [ ] #53 AGENTS.md in all repos
- [ ] #54 Replit Template (PincerPay Express API)
- [ ] #55 LangChain tool (langchain-pincerpay)
- [ ] #56 n8n community nodes (@pincerpay/n8n-nodes)
- [ ] #87 npm package SEO optimization
- [ ] #88 List MCP server on directories (MCP.so, LobeHub, Glama, cursor.directory)

---

## Medium Priority — Distribution Tier 2 + Phase S4 + Dashboard

### Distribution — Tier 2 (Week 3-6)
- [ ] #57 Cursor Marketplace Plugin
- [ ] #58 GitHub Copilot Extension (Skillset)
- [ ] #59 Vercel Marketplace Integration
- [ ] #60 QuickNode Marketplace add-on
- [ ] #61 Railway Template + Technology Partner
- [ ] #62 CrewAI tool (crewai-pincerpay)
- [ ] #63 ChatGPT Developer App (PincerPay for Developers)
- [ ] #86 Reddit marketing campaign

### Compliance (Phase S4)
- [ ] #18 Anchor compliance program (Transfer Hook)
- [ ] #19 OFAC screening integration at Facilitator layer
- [ ] #20 Compressed account compliance screening
- [ ] #21 Dashboard compliance audit log
- [ ] #22 Merchant opt-in for Transfer Hook registration
- [ ] #23 Compliance-as-a-Service pricing tiers

### Developer Experience
- [ ] #24 Public documentation site (Docusaurus/Nextra)
- [ ] #26 SDK quickstart guides (merchant + agent)
- [ ] #27 Example: Next.js merchant with PincerPay paywall
- [ ] #28 Example: AI agent with spending policies + Squads

### Dashboard Improvements
- [ ] #30 Real-time transaction feed on dashboard
- [ ] #32 Multi-merchant / team support
- [ ] #34 Merchant billing / usage dashboard

---

## Lower Priority — Distribution Tier 3 + Phase S5

### Distribution — Tier 3: Strategic Partnerships (Month 2-4)
- [ ] #64 Vercel x402 partnership (default Solana facilitator)
- [ ] #65 Google AP2 / A2A x402 compatibility
- [ ] #66 Stripe App Marketplace integration
- [ ] #67 Shopify App Store listing
- [ ] #68 OpenAI ACP integration (Solana-native)
- [ ] #69 Bolt.new / StackBlitz partnership
- [ ] #70 Cloudflare Workers partnership
- [ ] #71 AWS Marketplace listing
- [ ] #72 Supabase Partner Program

### Phase S5: Advanced Features
- [ ] #35 Micropayment batching with ZK compression
- [ ] #36 CCTP v2 EVM→Solana USDC bridging
- [ ] #37 Solana Actions for human-approval flows
- [ ] #38 Agent identity: DIDs + on-chain trust scores

### Protocol Integrations
- [ ] #40 AP2 mandate validation (Double-Lock)
- [ ] #41 A2A x402 Extension support (3-step flow)

### Growth / GTM
- [ ] #43 Mainnet deployment (Solana + Base)
- [ ] #44 Landing page refresh (marketing site)
- [ ] #45 Merchant onboarding email flow
- [ ] #46 Analytics: agent behavior patterns
- [ ] #47 Partner integrations: AI agent frameworks
- [ ] #48 Testnet faucet / sandbox mode

---

## Backlog — Distribution Tier 4 (Opportunistic)

- [ ] #73 Windsurf MCP Marketplace listing
- [ ] #74 Zapier integration
- [ ] #75 Pipedream integration
- [ ] #76 Make (Integromat) integration
- [ ] #77 RapidAPI listing
- [ ] #78 Postman API Network listing
- [ ] #79 Kong Plugin Hub (x402 payment gating)
- [ ] #80 GitHub Action (payment config validation)
- [ ] #81 Netlify Extension
- [ ] #82 Fly.io Extension
- [ ] #83 GCP Marketplace listing
- [ ] #84 Azure Marketplace listing
- [ ] #85 VS Code extension
