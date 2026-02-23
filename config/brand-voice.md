# PincerPay: Brand Voice & Style Guide

> Last updated: 2026-02-18

---

## Table of Contents

1. [Brand Identity](#brand-identity)
2. [Voice Principles](#voice-principles)
3. [Tone Spectrum](#tone-spectrum)
4. [Writing Guidelines](#writing-guidelines)
5. [Vocabulary & Terminology](#vocabulary--terminology)
6. [Channel-Specific Voice](#channel-specific-voice)
7. [Visual Language & Formatting](#visual-language--formatting)
8. [Anti-Patterns](#anti-patterns)
9. [Example Rewrites](#example-rewrites)

---

## 1. Brand Identity

### What PincerPay Is

PincerPay is infrastructure. It's the payment layer between AI agents and the services they consume. We are a protocol company, not a fintech company. We build plumbing — reliable, invisible, essential.

### Brand Personality

If PincerPay were a person, it would be:

- **The senior engineer** who explains complex systems simply, not the marketer who oversells
- **Opinionated but not dogmatic** — we have strong views on why non-custodial matters and why card rails are dead for agents, but we back every opinion with technical reasoning
- **Calm and competent** — we don't use urgency, hype, or FOMO because our value proposition stands on its own
- **Builder-first** — we speak to people who ship code, not people who read pitch decks

### Brand Promise

We make machine-to-machine payments work. When you integrate PincerPay, payments disappear — they become as invisible and reliable as a DNS lookup. Agents pay, merchants get paid, and nobody thinks about it.

---

## 2. Voice Principles

### Principle 1: Technical Precision

Say exactly what we mean. Use the correct terminology. Don't simplify to the point of inaccuracy — our audience is developers who will notice and lose trust.

| Do | Don't |
|----|-------|
| "Settlement is on-chain via USDC on Solana" | "We handle payments on the blockchain" |
| "The agent SDK wraps fetch and handles 402 responses automatically" | "Our AI-powered SDK seamlessly integrates payments" |
| "Kora enables agents to pay gas fees in USDC instead of SOL" | "We eliminate gas fees" |

### Principle 2: Show, Don't Tell

Code is more convincing than copy. Lead with examples, not adjectives. A three-line integration snippet does more work than a paragraph of value props.

| Do | Don't |
|----|-------|
| ````agent.fetch("https://api.example.com/data")```` followed by "That's it. The agent handles the 402 challenge automatically." | "Our revolutionary SDK makes it incredibly easy to integrate payments into your agent workflow with minimal effort." |

### Principle 3: Honest Scope

Be direct about what we are and what we aren't. Acknowledge tradeoffs. Developers respect honesty and punish overclaiming.

| Do | Don't |
|----|-------|
| "PincerPay settles in USDC. If you need fiat settlement, you'll need an off-ramp." | "PincerPay handles all your payment needs." |
| "Solana is our primary chain. EVM support (Base, Polygon) is maintained but secondary." | "We support every blockchain." |
| "Optimistic finality for sub-$1 — larger transactions wait for confirmation." | "Instant settlement for all transactions." |

### Principle 4: Respect the Reader's Time

Get to the point. Developers scan; they don't read marketing prose. Front-load the important information. Cut filler words.

| Do | Don't |
|----|-------|
| "Add three lines of middleware. Your API now accepts USDC from agents." | "In today's rapidly evolving landscape of AI-driven commerce, the ability to accept payments from autonomous agents is becoming increasingly important for forward-thinking API providers." |

### Principle 5: Protocol, Not Platform

We build open infrastructure, not a walled garden. Emphasize standards (x402, AP2, UCP), composability, and non-custodial design. We succeed when the protocol wins, even if others build on it.

| Do | Don't |
|----|-------|
| "PincerPay implements the x402 protocol" | "PincerPay's proprietary payment technology" |
| "Non-custodial — agents keep their own keys" | "We securely manage your funds" |
| "Any x402-compatible facilitator works" | "You must use PincerPay for everything" |

---

## 3. Tone Spectrum

Our tone adapts to context, but always stays within the range below. We never hit the extremes of hype or coldness.

```
Cold/Academic ←——— [PincerPay lives here] ———→ Hype/Marketing

        |----[---====●====---]----|
        ↑         ↑    ↑         ↑
     Too dry   Docs  Blog    Too hyped
```

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| **Documentation** | Direct, precise, instructional. Zero filler. | "Install the package: `npm install @pincerpay/merchant`. Add the middleware to your Express app." |
| **Blog posts** | Conversational but substantive. Opinions welcome. | "Card rails were designed for humans. Agents don't have thumbs, let alone credit cards. That's the problem x402 solves." |
| **Twitter/X** | Punchy, opinionated, occasionally dry humor. | "Your agent just paid $0.001 for weather data. Stripe would have charged $0.30. Math is math." |
| **Discord** | Warm, helpful, peer-to-peer. First names. | "Hey! That error means your agent wallet doesn't have USDC on devnet. Grab some from the faucet — here's the link." |
| **Changelogs** | Factual, scannable, technical. | "Added: Kora gasless signer for Solana. Agents now pay gas in USDC. Fixed: Confirmation worker race condition on high-throughput." |
| **Error messages** | Clear, actionable, no blame. | "Payment failed: insufficient USDC balance. The agent wallet needs at least 0.001 USDC on Solana devnet." |
| **Landing page** | Confident, concise, code-forward. | "Accept payments from AI agents. Add a few lines of code. Settle instantly in USDC." |

---

## 4. Writing Guidelines

### Structure

- **Lead with the action or outcome**, not the setup
- **One idea per paragraph** in docs; one idea per tweet
- **Use headers aggressively** — developers scan, they don't read top-to-bottom
- **Code blocks before prose** when explaining integrations
- **Bullet points over paragraphs** for lists of features, steps, or options

### Sentences

- **Short sentences by default.** Compound sentences only when the ideas are genuinely connected.
- **Active voice always.** "The facilitator broadcasts the transaction" not "The transaction is broadcast by the facilitator."
- **Present tense.** "The agent sends a signed transaction" not "The agent will send a signed transaction."
- **Second person ("you") in docs.** "You add the middleware to your Express app." Not "Developers add the middleware to their Express app."

### Numbers & Specifics

- **Use real numbers.** "$0.0001 per transaction" beats "incredibly low fees."
- **Show the comparison.** "99.9% cheaper than card rails" is a number we've earned — use it.
- **Be specific about chains.** "Solana (primary), Base, Polygon" not "multiple blockchains."
- **Use real code, not pseudocode.** Our audience can read TypeScript.

### Formatting Conventions

- **Product name**: PincerPay (one word, capital P capital P)
- **Protocol names**: x402, AP2, UCP (lowercase x, uppercase everything else)
- **Package names**: `@pincerpay/agent`, `@pincerpay/merchant` (always in code format)
- **Chain names**: Solana, Base, Polygon (capitalized)
- **Currency**: USDC, SOL, ETH (all caps)
- **Amounts**: Use decimal format with unit. "$0.001 USDC" or "0.001 USDC" — not "1000 microUSDC"

---

## 5. Vocabulary & Terminology

### Use These Terms

| Term | Definition | Usage Context |
|------|-----------|---------------|
| **Agent** | An AI program that autonomously transacts | Preferred over "bot", "AI", "autonomous system" |
| **Merchant** | A developer or service that accepts payments via PincerPay | Preferred over "seller", "vendor", "provider" |
| **Facilitator** | The server that verifies and settles x402 payments | Specific — not "server", "backend", "processor" |
| **Settlement** | The on-chain transfer of USDC from agent to merchant | Preferred over "payment processing", "transaction handling" |
| **Paywall** | A configured price gate on an HTTP endpoint | Specific to PincerPay — not "payment gate", "toll" |
| **Session keys** | Scoped, time-limited signing permissions (Squads SPN / ERC-7715) | Technical — use in docs and deep dives |
| **Mandate** | An AP2 authorization scope (Intent, Cart, or Payment) | Protocol-specific — always explain on first use |
| **Non-custodial** | Agents hold their own keys; PincerPay never controls funds | Critical differentiator — use frequently |
| **Gas passthrough** | Agents pay their own gas (via Kora in USDC on Solana) | Differentiator — PincerPay never subsidizes gas |

### Avoid These Terms

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| "Seamless" | Meaningless marketing filler | Describe the actual mechanism |
| "Revolutionary" / "Groundbreaking" | Overclaiming — let the tech speak | Just describe what it does |
| "Leverage" (as a verb) | Corporate jargon | "Use", "build on", "integrate with" |
| "Ecosystem" (vague) | Only use when referring to a specific one | "Solana ecosystem", "LangChain community" |
| "Web3" (as a selling point) | Loaded term; our audience has opinions | "On-chain", "stablecoin", specific chain names |
| "Crypto payments" | Too broad, evokes speculation | "Stablecoin settlement", "USDC payments" |
| "Trustless" | Technically inaccurate (trust is relocated, not eliminated) | "Non-custodial", "verifiable on-chain" |
| "Frictionless" | Nothing is frictionless | Describe the actual reduction in friction |
| "Blockchain" (standalone) | Too generic | Name the specific chain: "Solana", "Base" |
| "DeFi" | Wrong framing for payments | "On-chain payments", "stablecoin settlement" |

---

## 6. Channel-Specific Voice

### GitHub (READMEs, Issues, PRs)

- **Tone**: Technical, minimal, scannable
- **Structure**: Badge row → one-line description → install command → 5-line usage example → link to full docs
- **Rules**:
  - README should get a developer to "hello world" in under 60 seconds of reading
  - Issue responses: reproduce first, then explain, then fix
  - PR descriptions: what changed, why, how to test
- **Never**: Marketing language in a README. "Fast, reliable, scalable" belongs on a landing page, not in a package README.

### npm Package Pages

- **Tone**: Documentation-forward
- **Structure**: One-line description → install → basic usage → link to docs
- **Keywords**: Optimize for discoverability: "x402", "ai agent payments", "usdc", "solana payments", "http 402"
- **Never**: Long marketing intros before the install command

### Twitter/X

- **Tone**: Opinionated, punchy, occasionally dry
- **Structure**: Hook → substance → (optional) code screenshot or playground link
- **Formats that work**:
  - Cost comparisons with real numbers
  - "We shipped X" with a code snippet
  - Hot takes on agent economy trends (backed by reasoning)
  - Playground demos (link to demo.pincerpay.com)
  - Thread format for technical deep dives (max 5 tweets)
- **Never**: Engagement bait ("What do you think?"), hashtag spam, "GM" posts, price/token speculation

### Blog

- **Tone**: Substantive, opinionated, long-form
- **Structure**: Clear thesis in first paragraph → evidence/argument → code examples → conclusion
- **Length**: 800–2000 words. Shorter for announcements, longer for deep dives
- **Rules**:
  - Every blog post should teach something or argue something
  - No "filler" posts — if we don't have something worth saying, we don't post
  - Include code examples in any technical post
  - End with a concrete next step (try it, read the docs, join Discord)
- **Never**: Thinly-veiled press releases disguised as blog posts

### Discord

- **Tone**: Warm, peer-to-peer, helpful
- **Rules**:
  - Respond to support questions within 2 hours during business hours
  - Use first names or handles
  - Share code snippets, not just explanations
  - Admit when something is a bug, don't deflect
  - Celebrate community projects in #showcase
- **Never**: Corporate tone. "Thank you for reaching out to PincerPay support" — just answer the question

### Documentation

- **Tone**: Direct, instructional, zero filler
- **Structure**: What → Why (one sentence) → How (code example) → Reference
- **Rules**:
  - Every page should be independently useful (no "see previous section" dependencies)
  - Code examples must be copy-pasteable and working
  - Use realistic values in examples (actual USDC amounts, real chain names)
  - Version everything — docs should match the current release
- **Never**: Marketing language in docs. Docs are for people who've already decided to use PincerPay

### Error Messages & CLI Output

- **Tone**: Clear, actionable, empathetic
- **Structure**: What happened → Why → How to fix it
- **Rules**:
  - Never blame the user ("Invalid input" → "Expected a Solana address (base58), got an Ethereum address (0x...)")
  - Include the fix, not just the problem
  - Link to relevant docs when helpful
- **Examples**:
  - `Error: SOLANA_PRIVATE_KEY not set. The facilitator needs a Solana keypair to sign transactions. See docs: https://pincerpay.com/docs/facilitator/setup`
  - `Warning: CORS_ORIGINS not configured. In production, restrict origins to your dashboard domain. See: https://pincerpay.com/docs/facilitator/security`

---

## 7. Visual Language & Formatting

### Code Presentation

- **Language labels on code blocks**: Always specify the language (````typescript`, ````bash`, ````json`)
- **Realistic examples**: Use `pincerpay.com`, real USDC amounts (0.001, not 1000000), actual chain names
- **Minimal but complete**: Examples should run if copy-pasted, but don't include boilerplate that distracts from the point
- **Comments sparingly**: Only comment non-obvious lines

### Diagrams & Architecture

- **Text-based diagrams** (Mermaid, ASCII) preferred over images for docs — they're version-controllable and accessible
- **Left-to-right flow** for payment sequences (Agent → Facilitator → Chain → Merchant)
- **Minimal boxes**: Only show components relevant to the current explanation
- **Label all arrows**: "402 challenge", "signed tx", "USDC transfer", "receipt"

### Social Media Visual Style

- **Code screenshots**: Dark theme, large font, minimal chrome (use tools like Carbon or ray.so)
- **Demo videos**: Terminal or browser, no slide intros, start with the action
- **Comparison graphics**: Clean tables, real numbers, no decorative elements
- **Colors**: Lean into Solana's purple/teal gradients for Solana-specific content; neutral dark backgrounds for general content

---

## 8. Anti-Patterns

Things PincerPay communications should never do:

### Hype Language
> "PincerPay is the revolutionary, game-changing, next-generation payment infrastructure that will transform the future of commerce forever."

This says nothing. Every adjective weakens the message.

### Vague Promises
> "PincerPay makes payments easy."

Easy compared to what? For whom? Be specific: "Add three lines of Express middleware. Your API accepts USDC from agents."

### Feature Laundry Lists
> "PincerPay offers multi-chain support, gasless transactions, smart accounts, on-chain settlement, compliance screening, mandate authorization, and much more!"

Lists without context are noise. Pick the 1–2 features that matter for the audience and explain them well.

### Apologetic Hedging
> "We're still early and there's a lot of work to do, but we think PincerPay might be useful for some developers who are starting to explore agent payments."

Ship with confidence. If it's live and working, say so directly: "PincerPay is live. Solana USDC settlement in production. Try it."

### Competitor Bashing
> "Unlike [competitor] which is slow, expensive, and insecure..."

State our strengths. Use comparison tables with real data. Let the numbers speak; don't editorialize about competitors.

### Buzzword Stacking
> "Our AI-powered Web3 DeFi payment protocol leverages blockchain technology to enable trustless, frictionless, decentralized commerce."

Every buzzword reduces credibility. Use specific, accurate terms.

---

## 9. Example Rewrites

### Landing Page Hero

**Before (generic):**
> Welcome to PincerPay, the next-generation payment solution for the future of AI commerce. Our innovative platform seamlessly connects artificial intelligence agents with merchants through cutting-edge blockchain technology.

**After (PincerPay voice):**
> Accept payments from AI agents. Add a few lines of code. Settle instantly in USDC.

### Tweet Announcing a Feature

**Before (corporate):**
> We're thrilled to announce that PincerPay now supports gasless transactions on Solana via our integration with Kora! This exciting new feature eliminates the need for agents to hold SOL, making the payment experience more seamless than ever. #Web3 #AI #Solana #DeFi

**After (PincerPay voice):**
> Agents on PincerPay no longer need SOL for gas. Kora integration is live — agents pay gas in USDC.
>
> One less token to manage. One less thing to break.
>
> Docs: [link]

### Error Message

**Before (unhelpful):**
> Error: Transaction failed.

**After (PincerPay voice):**
> Payment failed: Agent wallet has 0.0005 USDC but the paywall requires 0.001 USDC (Solana devnet). Fund the wallet or lower the paywall price. Faucet: https://faucet.circle.com

### Blog Post Opening

**Before (throat-clearing):**
> In today's rapidly evolving technological landscape, the intersection of artificial intelligence and financial technology is creating unprecedented opportunities for innovation. As we stand on the cusp of a new era in autonomous commerce, it's worth examining how traditional payment rails fall short when it comes to serving the needs of AI agents.

**After (PincerPay voice):**
> AI agents make thousands of API calls per hour. They don't have credit cards, billing addresses, or thumbs for 3D Secure. They need a payment protocol that speaks HTTP and settles on-chain. That's x402, and PincerPay is the infrastructure layer that makes it production-ready.

### Documentation Introduction

**Before (marketing in docs):**
> Welcome to PincerPay, the world's leading payment gateway for the agentic economy! We're so glad you're here. PincerPay offers a comprehensive suite of tools that makes it incredibly easy to accept payments from AI agents.

**After (PincerPay voice):**
> PincerPay is an x402 payment gateway. Merchants add middleware to accept USDC; agents wrap fetch calls to pay automatically. This guide gets you from zero to a working integration in 5 minutes.
