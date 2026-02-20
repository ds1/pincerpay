# Agentic Payments Protocol Research

**Date:** 2026-02-15
**Purpose:** Deep research into the agentic payments ecosystem to inform PincerPay's product strategy

---

## Executive Summary

The agentic payments space is rapidly coalescing around four complementary protocols that operate at different layers of the stack. These are **not competitors** — they are layers that work together. A comprehensive agentic payment service should support multiple protocols to maximize merchant reach.

### The Protocol Stack

| Layer | Protocol | Creator | Function |
|-------|----------|---------|----------|
| **Trust/Authorization** | AP2 | Google (60+ partners) | Cryptographic mandates proving user intent |
| **Commerce Lifecycle** | UCP | Google + Shopify (20+ partners) | Full discovery → checkout → fulfillment |
| **Checkout Conversation** | ACP | OpenAI + Stripe | Agent-merchant checkout in AI assistants |
| **Execution/Settlement** | x402 | Coinbase + Cloudflare | HTTP-native on-chain micropayments |

### Key Insight for PincerPay

The market gap is clear: **no single service today makes it easy for a merchant to accept payments from AI agents across all protocols and all chains.** Stripe owns ACP but doesn't do on-chain. Coinbase owns x402 but doesn't do traditional rails. Google's AP2/UCP are rail-agnostic but have no turnkey merchant product. PincerPay's opportunity is to be the **unified agentic payment gateway** — one integration, all protocols, all rails.

---

## 1. x402 — HTTP-Native On-Chain Payments

### Overview
x402 revives the HTTP 402 "Payment Required" status code to embed programmable, on-chain payments directly into standard HTTP request/response flows. Created by **Coinbase** (May 2025), backed by Cloudflare and the x402 Foundation.

### How It Works
1. Client requests a paid resource → Server responds `402 Payment Required` with payment instructions
2. Client signs a payment payload (EIP-3009 Transfer With Authorization)
3. Client retries with `PAYMENT-SIGNATURE` header
4. Server verifies signature via Facilitator, serves resource, settles on-chain
5. Full cycle: ~1.5-2 seconds

### Three Roles
- **Client (Payer):** Any HTTP client with a crypto wallet
- **Resource Server (Payee):** HTTP service with payment middleware
- **Facilitator:** Verifies signatures and settles on-chain (Coinbase CDP provides free USDC settlement on Base)

### Supported Chains & Tokens

**EVM Networks:**
| Network | Chain ID | Status |
|---------|----------|--------|
| Base | 8453 | Mainnet (primary) |
| Ethereum | 1 | Mainnet |
| Polygon | 137 | Mainnet |
| Optimism | 10 | Mainnet |
| Arbitrum One | 42161 | Mainnet |
| Avalanche C-Chain | 43114 | Mainnet |

**Solana:** Mainnet + Devnet supported

**Tokens:** USDC (primary), EURC. Uses EIP-3009 which USDT does NOT support.

### SDKs (coinbase/x402 — 5,400+ stars)
- **TypeScript:** `@x402/core`, `@x402/evm`, `@x402/svm`, `@x402/fetch`, `@x402/express`, `@x402/next`, `@x402/hono`
- **Python:** `x402` on PyPI (FastAPI, Flask, httpx, requests)
- **Go:** `github.com/coinbase/x402/go`
- **Java:** In monorepo

### Integration (Server-Side — ~5 lines of code)
```typescript
import { paymentMiddleware } from "@x402/express";

app.use(paymentMiddleware(WALLET_ADDRESS, {
  "GET /premium-data": { price: "$0.10", network: "eip155:8453" }
}, { url: "https://x402.org/facilitator" }));
```

### Traction
- 100M+ payments processed by Dec 2025
- $600M+ annualized volume
- 156K weekly transactions, 492% growth rate
- V2 launched Dec 2025 (sessions, multi-chain, plugin architecture)

### Limitations
- EIP-3009 dependency = effectively USDC-only on EVM (USDT excluded)
- Facilitator economics unsustainable (free processing, no revenue model)
- Two-phase settlement adds 500-1100ms latency per request
- Bootstrap/cold-start problem for new standard

### Key Sources
- Spec & SDK: https://github.com/coinbase/x402
- Docs: https://docs.cdp.coinbase.com/x402/welcome
- Website: https://www.x402.org/
- Whitepaper: https://www.x402.org/x402-whitepaper.pdf

---

## 2. AP2 — Agent Payments Protocol

### Overview
AP2 is Google's open protocol for enabling AI agents to securely initiate payments on behalf of users. It introduces **cryptographic mandates** — tamper-proof, digitally signed proofs of user intent that create a verifiable authorization chain from human to payment settlement. Announced September 2025, Apache 2.0 license.

### The Problem It Solves
Traditional payment systems assume a human clicks "buy." When an AI agent initiates payment, three gaps emerge:
1. **Authorization** — How to verify user gave agent spending authority?
2. **Authenticity** — How to ensure agent reflects true user intent (not hallucination)?
3. **Accountability** — Who is liable if something goes wrong?

AP2 replaces inference-based trust with **deterministic, cryptographic proof**.

### Architecture — Six Roles
| Role | Function |
|------|----------|
| User | Human who authorizes via hardware-backed keys |
| Shopping Agent | AI that discovers products (Gemini, ChatGPT, etc.) |
| Credentials Provider | Manages payment credentials (PCI-isolated) |
| Merchant Endpoint | Represents seller, signs cart guarantees |
| Merchant Payment Processor | Constructs authorization for networks |
| Network/Issuer | Traditional payment infra (Visa, Mastercard) |

### Three Mandate Types (W3C Verifiable Credentials)
1. **CartMandate** — Human-present: user reviews and signs a specific cart
2. **IntentMandate** — Human-not-present: user pre-authorizes with constraints (merchant allow-list, price ceiling, SKU restrictions, TTL)
3. **PaymentMandate** — Transmitted to processor with authorization, cart hash, payment token, agent-presence signals

### Transaction Flows
**Human-Present:** Agent builds cart → Merchant signs CartMandate → User signs on trusted device → Payment token requested → Authorization sent to network
**Human-Not-Present:** User signs IntentMandate with constraints → Agent autonomously transacts when conditions met

### Supported Rails
- **Rail-agnostic by design** — sits above payment rails as trust layer
- V0.1: Credit/debit cards (tokenized), USDC via x402 (Base + Solana)
- V1.x planned: Push payments, bank transfers, e-wallets, subscriptions

### SDKs
- **Python SDK** (primary): Pydantic models, A2A extension, MCP server
- **Android SDK**: Digital Payment Credentials scenario
- Repo: https://github.com/google-agentic-commerce/AP2 (2.8k stars)

### Partners (60+)
Mastercard, American Express, Visa, PayPal, Adyen, Worldpay, Coinbase, Salesforce, ServiceNow, Cloudflare, Shopify, Target, Walmart, Best Buy, Etsy, and many more.

### Adoption Status
- Mastercard: Agent Pay live for all US cardholders (Nov 2025)
- Visa: Hundreds of secure agent-initiated transactions completed (Dec 2025)
- PayPal: Detailed integration plan published
- Still early vs ACP (which is already live in ChatGPT)

### Key Sources
- Spec: https://ap2-protocol.org/
- Repo: https://github.com/google-agentic-commerce/AP2
- Google blog: https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol

---

## 3. UCP — Universal Commerce Protocol

### Overview
UCP is the most ambitious protocol — a full-lifecycle commerce standard covering discovery, negotiation, checkout, payment, and post-purchase. Created by **Google + Shopify** with 20+ major retail and payment partners. Launched at NRF 2026 (January 2026), Apache 2.0. Described as "the HTTP of shopping."

### Layered Architecture (TCP/IP-inspired)
| Layer | Purpose | Example |
|-------|---------|---------|
| Services | Transaction primitives + transport | `dev.ucp.shopping` |
| Capabilities | Major features, independently versioned | Checkout, Order, Identity Linking |
| Extensions | Domain-specific augmentations | Discounts, AP2 Mandates |

### Four Roles
1. **Platform (Agent):** Consumer-facing AI surface
2. **Business (Merchant):** Seller, merchant of record
3. **Credential Provider:** Manages payment credentials, issues tokens
4. **PSP:** Processes payments and settlements

### Discovery
Merchants publish `/.well-known/ucp` JSON manifest declaring services, capabilities, payment handlers, and signing keys. Agents fetch this to discover what the merchant supports.

### Checkout Flow
1. Agent fetches `/.well-known/ucp` manifest
2. Agent POSTs to `/checkout-sessions` with line items
3. Sessions progress: `incomplete` → `requires_escalation` → `ready_for_complete`
4. Agent submits payment instruments, merchant completes transaction
5. Graceful human handoff via `continue_url` when needed

### Transport Bindings
- REST API (OpenAPI 3.x)
- MCP (Model Context Protocol) — JSON-RPC
- A2A (Agent-to-Agent) — Agent Card spec
- Embedded Protocol (for human handoff)

### Payment Support
- **Traditional:** Google Pay, Shop Pay, cards via PSP tokenization (Stripe, Adyen)
- **AP2 mandates** for autonomous agent payments
- **Crypto:** MultiversX (first L1 blockchain integration), x402 stablecoin integration
- PayPal coming soon

### SDKs
- GitHub org: https://github.com/Universal-Commerce-Protocol
- Python SDK, JavaScript/TypeScript SDK, Rust schema validator
- Reference implementations in Python+FastAPI and Node.js+Hono

### Adoption
- **Live** in Google Search AI Mode, Gemini App, Google Shopping (US)
- Shopify: Agentic storefronts active by default for eligible stores
- Partners: Target, Walmart, Best Buy, Macy's, Home Depot, Wayfair, Etsy, Flipkart, Zalando
- Payment partners: Stripe, Adyen, Visa, Mastercard, Amex, Google Pay, Shop Pay

### PSP Integration Path
1. Author a Payment Handler specification (`com.yourcompany.pay`)
2. Define instrument schemas extending UCP base types
3. Implement tokenization endpoint (PCI Level 1)
4. Merchants add your handler to their `/.well-known/ucp` manifest
5. Support API-first transactions (no redirect checkout pages)
6. Implement webhook-based order lifecycle events

### Key Sources
- Website: https://ucp.dev/
- Spec: https://ucp.dev/2026-01-23/specification/overview/
- Repo: https://github.com/Universal-Commerce-Protocol
- Shopify engineering: https://shopify.engineering/ucp

---

## 4. ACP — Agentic Commerce Protocol

### Overview
ACP is the OpenAI + Stripe protocol for standardizing agent-merchant checkout within AI assistants. It is the **first protocol to reach production** — live in ChatGPT Instant Checkout. Apache 2.0, with a spec versioned by date (current: 2026-01-30).

### Architecture
- **Buyer:** Selects products, provides payment credentials
- **AI Agent:** Interfaces with buyer, requests checkout
- **Business/Merchant:** Merchant of record, controls transaction
- **PSP:** Handles tokenized credential transmission (Stripe first, PSP-agnostic by design)

### Core Endpoints (Merchant implements)
1. **Create Checkout** (POST) — Generate cart from SKU
2. **Update Checkout** (PUT/PATCH) — Modify items, fulfillment, details
3. **Complete Checkout** (POST) — Accept SharedPaymentToken, process payment
4. **Cancel Checkout** (DELETE/POST) — Release inventory

### SharedPaymentToken (SPT)
Stripe's innovation — a scoped payment token that is:
- Single-use, time-bound, amount-capped, merchant-scoped
- Enriched with Stripe Radar fraud signals
- Agent and merchant never see raw card numbers

### Delegated Payment Flow
1. Customer provides payment method to agent
2. Agent requests SPT from Stripe (scoped to merchant + amount + time window)
3. Agent sends SPT to merchant via Complete Checkout
4. Merchant creates PaymentIntent using SPT through Stripe
5. Settlement on traditional card rails

### Payment Rails
- **Traditional only:** Credit/debit cards via Stripe (Visa, Mastercard, Amex)
- No native blockchain/crypto support
- PSP-agnostic spec, but Stripe is currently the only compatible PSP
- PayPal announced automatic ACP support coming 2026

### Adoption (Most Advanced)
- **Production** in ChatGPT Instant Checkout (US)
- Shopify: 1M+ merchants enabled
- Etsy: Platform-wide support
- Stripe Agentic Commerce Suite launched Dec 2025
- Brands: Coach, Kate Spade, URBN, Revolve, Ashley Furniture
- Walmart: 20% of referral traffic now from ChatGPT

### Integration Options for PincerPay
- **Option A:** Become an ACP-compatible PSP (implement Delegated Payment endpoint, issue scoped tokens — requires PCI Level 1)
- **Option B:** Build on Stripe's ACP infrastructure (leverage SPTs, add value with multi-protocol support)
- **Option C:** Multi-protocol orchestration layer (ACP + UCP + AP2 + x402 behind unified merchant API)

### Key Sources
- Spec: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
- Website: https://www.agenticcommerce.dev/
- OpenAI docs: https://developers.openai.com/commerce/
- Stripe docs: https://docs.stripe.com/agentic-commerce/protocol

---

## 5. Protocol Comparison Matrix

| Dimension | x402 | AP2 | UCP | ACP |
|-----------|------|-----|-----|-----|
| **Creator** | Coinbase | Google | Google + Shopify | OpenAI + Stripe |
| **Layer** | Execution/Settlement | Trust/Authorization | Full Commerce Lifecycle | Checkout Conversation |
| **Payment Rails** | On-chain (USDC) | Rail-agnostic (trust layer) | Traditional + crypto | Traditional (Stripe) |
| **Chains** | Base, Solana, Polygon, Ethereum, Arbitrum, Optimism, Avalanche | Via x402 extension (Base, Solana) | Via x402 + MultiversX | None (card rails only) |
| **Production?** | Yes (100M+ payments) | Early (pilots live) | Yes (Google surfaces, Shopify) | Yes (ChatGPT Instant Checkout) |
| **Merchant Effort** | 5 lines of middleware | Agent card declaration | `/.well-known/ucp` manifest | 4 REST endpoints |
| **Best For** | API monetization, machine-to-machine, micropayments | Enterprise compliance, cross-platform trust | Full shopping experiences | Quick conversational commerce |
| **Limitation** | USDC-only (EVM), no traditional rails | Early, complex, no turnkey product | Google-surface heavy | Stripe-locked, no crypto |

---

## 6. Strategic Implications for PincerPay

### The "Stripe for Agentic On-Chain Payments" Positioning

PincerPay's stated goal — "the easiest and most flexible way to enable on-chain agentic payments" — maps to a specific gap in the market:

**What exists today:**
- Stripe: Owns ACP, traditional rails only, no on-chain
- Coinbase: Owns x402, on-chain only, no traditional rails
- Google: Owns AP2 + UCP, rail-agnostic but no turnkey merchant product
- Skyfire, PaymanAI: Early-stage competitors in agentic payment infra

**What's missing:**
A single integration point that lets merchants accept agentic payments across:
- All protocols (x402, AP2, UCP, ACP)
- All chains (Base, Solana, Polygon, Ethereum, Arbitrum, Optimism)
- Both on-chain (USDC stablecoins) and traditional (card) rails
- All agent surfaces (ChatGPT, Gemini, custom agents)

### Recommended Architecture Layers

```
┌─────────────────────────────────────────────────┐
│             MERCHANT INTEGRATION                 │
│  Single SDK / API — "npm install pincerpay"      │
├─────────────────────────────────────────────────┤
│           PROTOCOL ORCHESTRATION                 │
│  x402 Handler │ AP2 Agent │ UCP Handler │ ACP   │
├─────────────────────────────────────────────────┤
│            PAYMENT PROCESSING                    │
│  USDC Settlement │ Token Mgmt │ Fiat Off-ramp   │
├─────────────────────────────────────────────────┤
│              CHAIN ABSTRACTION                   │
│  Base │ Solana │ Polygon │ Ethereum │ Arbitrum   │
├─────────────────────────────────────────────────┤
│           TRUST & COMPLIANCE                     │
│  KYC/KYT │ OFAC │ Mandate Validation │ Audit    │
└─────────────────────────────────────────────────┘
```

### Differentiation Vectors
1. **Protocol-agnostic:** Support all four protocols from day one
2. **On-chain native with fiat bridge:** USDC settlement + optional fiat off-ramp
3. **Multi-chain:** Base, Solana, Polygon, Ethereum from launch
4. **One-line integration:** Match x402's simplicity (`app.use(pincerpay())`)
5. **Self-hostable facilitator:** Don't depend on Coinbase's free facilitator
6. **Merchant dashboard:** Analytics, settlement tracking, protocol routing

### Phase 1 Priority (MVP)
Focus on **x402 first** — it's the most mature on-chain protocol, has the simplest integration model, and directly serves the "on-chain agentic payments" use case. Layer in AP2 mandate validation and UCP discovery support in Phase 2.

---

---

## 7. Agentic Payments Landscape & Competitive Analysis

### Market Scale
- Agentic AI projected to influence **$1T+ in e-commerce spending**
- 81% of U.S. consumers expect to use agentic AI to shop
- **45% CAGR** from 2024-2030 (BCG)
- ChatGPT-referred traffic converts at 11.4% (nearly 2x direct visits)
- 20% of Walmart's referral traffic now comes from ChatGPT

### Four Emerging Use Cases
1. **B2C Consumer Commerce** — AI shopping assistants (ChatGPT Instant Checkout, Google AI Mode). Most competitive segment.
2. **B2B Payments** — Procurement, invoices, vendor payments. **Massive TAM, almost no infrastructure built.** Natural.co ($9.8M seed) is the only focused player.
3. **Agent-to-Agent (A2A)** — Agents buying/selling compute, data, API access. x402 enables micropayments down to $0.001. Most technically novel.
4. **Machine-to-Machine (M2M)** — API paywalls, metered compute, IoT. Emerging.

### Two Industry Coalitions Forming
| Coalition | Protocols | Blockchain | Rails |
|-----------|-----------|------------|-------|
| **OpenAI + Stripe** | ACP | Tempo ($5B valuation, testnet) | Cards + stablecoins |
| **Google + Coinbase** | UCP + AP2 + x402 | Base + Solana + multi-chain | Cards + stablecoins |

Both pursuing hybrid (traditional + on-chain). Neither has a turnkey, protocol-agnostic merchant solution.

### Key Competitors

**Tier 1 — Card Networks (Setting the Rules):**
- **Visa:** Trusted Agent Protocol (TAP), Intelligent Commerce platform. Partners: Anthropic, Microsoft, OpenAI, Stripe, Skyfire
- **Mastercard:** Agent Pay (live for all US cardholders Nov 2025), agentic tokens, agent registration framework

**Tier 2 — Payment Platforms:**
- **Stripe:** ACP + Agent Toolkit + x402/USDC preview + Tempo blockchain. Most comprehensive strategy but ACP only works with Stripe merchants
- **PayPal:** UCP/AP2 consortium + Microsoft Copilot Checkout

**Tier 3 — Crypto Native:**
- **Coinbase:** x402 + Agentic Wallets (launched Feb 12, 2026) + Base L2. 50M+ x402 txns on Base
- **Circle:** USDC issuer, Gateway product (unified cross-chain balance + micropayment batching), Arc L1

**Tier 4 — Agentic-Native Startups:**
- **Skyfire:** "World's only payment network for the AI Agent economy." KYAPay Protocol, Visa integration. $9.5M funding
- **Natural.co:** B2B focused, natural language payment initiation, ACH-first. $9.8M seed
- **PaymanAI:** Agents paying humans for tasks (Skyfire infrastructure)
- **Prove:** Verified Agent identity solution
- Others: PayOS, Nekuda, Prava, Proxy, Rye, Induced AI

### Stripe's Specific Vulnerabilities
1. **ACP lock-in** — Only works with Stripe-connected merchants. Millions on Adyen, Square, Braintree excluded
2. **B2B gap** — ACP/UCP both focus on consumer checkout
3. **Micropayment economics** — Card fees make sub-cent transactions uneconomical; x402/USDC support still "preview"
4. **Agent-to-agent gap** — ACP assumes human buyer with card
5. **Settlement speed** — 1-3 day settlement vs agents needing seconds. Tempo not live yet
6. **Integration burden** — "Up to six months" per new AI agent integration

### Key Technical Challenges
1. **Identity/Auth** — No universal "Know Your Agent" standard. 5+ competing approaches, none interoperable
2. **Authorization** — How to define, enforce, revoke agent spending authority
3. **Fraud Detection** — Agent behavior looks identical to bot/fraud behavior
4. **Settlement Speed** — Agents need seconds; cards take days
5. **Micropayment Economics** — Card minimums ($0.10-0.30) kill sub-cent transactions
6. **Dispute Resolution** — No legal framework for agent-initiated transaction disputes
7. **Protocol Fragmentation** — Merchants may need 3-5 different protocol integrations

### USDC is the Default
Every major on-chain initiative uses USDC. Circle integration is mandatory:
- x402: USDC primary settlement currency
- Coinbase Agentic Wallets: USDC default holding
- Stripe x402: USDC on Base
- Visa: USDC settlement launched Dec 2025
- Circle Gateway: Chain-abstracted balance + micropayment batching

### Regulatory Landscape
- **No government has legislated AI agent payments specifically**
- Card network rules setting de facto standards ahead of regulation
- EU AI Act applies to high-risk AI financial systems
- No legal framework for agent-initiated dispute liability
- Building compliance by design = competitive advantage

### Five Market Gaps PincerPay Can Exploit

**Gap 1: B2B Agentic Payments** — Largest opportunity, least competition. ACP/UCP focus on B2C shopping. B2B (invoices, procurement, vendor payments) has massive TAM with almost no infrastructure.

**Gap 2: Agent-to-Agent Payment Infrastructure** — x402 is basic. No comprehensive platform combining agent service discovery + payment + settlement + reputation.

**Gap 3: Processor-Agnostic Orchestration** — ACP = Stripe only. UCP = Google Merchant Center. No protocol-agnostic layer working with any merchant's existing processor.

**Gap 4: Micropayment Settlement** — No production-ready batching/netting system optimized for hundreds of sub-cent agent transactions per interaction.

**Gap 5: Universal Trust Layer** — Five competing identity standards (Visa TAP, MC Agent Pay, Skyfire KYAPay, Prove, ERC-8004), none interoperable. A universal agent credential system would be enormously valuable.

---

## 8. PincerPay Strategic Synthesis

### Positioning
**"The unified gateway for agentic payments — one integration, all protocols, all chains, all rails."**

PincerPay sits in the orchestration layer between agents and merchants. It does not compete with x402, AP2, UCP, or ACP — it **speaks all of them**, so merchants don't have to.

### Why This Wins
- Stripe can't be protocol-agnostic (they own ACP)
- Coinbase can't do traditional rails (they're crypto-native)
- Google doesn't sell merchant products (they're a platform)
- No startup has the multi-protocol, multi-chain, multi-rail vision yet

### Recommended Architecture
```
┌─────────────────────────────────────────────────────┐
│              MERCHANT INTEGRATION                    │
│    Single SDK — "npm install pincerpay"              │
│    Dashboard — analytics, settlement, routing        │
├─────────────────────────────────────────────────────┤
│            PROTOCOL ORCHESTRATION                    │
│   x402 │ AP2 Mandates │ UCP Handler │ ACP │ TAP     │
├─────────────────────────────────────────────────────┤
│             PAYMENT PROCESSING                       │
│   USDC Settlement │ Micropayment Batching │ Fiat     │
├─────────────────────────────────────────────────────┤
│              CHAIN ABSTRACTION                       │
│   Base │ Solana │ Polygon │ Ethereum │ Arbitrum      │
├─────────────────────────────────────────────────────┤
│            TRUST & COMPLIANCE                        │
│   Agent Identity │ KYC/KYT │ OFAC │ Audit Trails    │
└─────────────────────────────────────────────────────┘
```

### Phased Approach

**Phase 1 — x402 Foundation (MVP)**
- Self-hostable x402 facilitator (don't depend on Coinbase's free one)
- Multi-chain USDC settlement (Base, Solana, Polygon)
- One-line merchant middleware (Express, Next.js, Hono)
- Merchant dashboard with settlement tracking
- **Differentiator:** Self-hosted facilitator + multi-chain from day one

**Phase 2 — Protocol Expansion**
- AP2 mandate validation (accept Google/Gemini agent payments)
- UCP `/.well-known/ucp` handler (discoverable by any UCP agent)
- ACP compatibility layer
- Micropayment batching and netting engine

**Phase 3 — Full Orchestration**
- Processor-agnostic: works with Stripe, Adyen, Square, or standalone
- Universal agent identity/credential system
- B2B payment rails (ACH, wire, USDC with intelligent routing)
- Fiat off-ramp for merchants who want USD settlement

### Revenue Model
Protocols are free (Apache 2.0). Charge for value-added services:
- Settlement and batching optimization (basis points on volume)
- Compliance/identity layer (SaaS subscription)
- Analytics and routing intelligence (tiered pricing)
- Self-hosted facilitator licensing (enterprise)

### Key Sources
- x402: https://github.com/coinbase/x402 | https://www.x402.org/
- AP2: https://github.com/google-agentic-commerce/AP2 | https://ap2-protocol.org/
- UCP: https://github.com/Universal-Commerce-Protocol | https://ucp.dev/
- ACP: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol | https://www.agenticcommerce.dev/
- Landscape map: https://www.fintechbrainfood.com/p/the-agentic-payments-map
- Natural.co memo: https://www.natural.co/blog/agentic-payments-memo

---

*Research compiled from five parallel deep research agents. All sources verified as of February 2026.*
