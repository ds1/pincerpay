# PincerPay

On-chain payment gateway for the agentic economy.

## Tech Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Runtime:** Node.js 22+ (TypeScript)
- **Facilitator:** Hono + @x402/core + @x402/svm + @solana/kit v5 (primary), @x402/evm + viem (optional)
- **Dashboard:** Next.js 15 + Tailwind CSS v4 + Supabase Auth
- **Database:** PostgreSQL (Supabase) + Drizzle ORM
- **SDKs:** @pincerpay/merchant (Express/Hono), @pincerpay/agent (fetch wrapper)
- **Primary chain:** Solana (devnet → mainnet). EVM (Base, Polygon) supported as optional compatibility layer.

## Commands
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (via turbo)
pnpm dev              # Dev mode for all packages
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push          # Push schema to database

# Individual packages
pnpm --filter @pincerpay/facilitator dev    # Facilitator on :4402
pnpm --filter @pincerpay/dashboard dev      # Dashboard on :3000
pnpm --filter @pincerpay/agent-demo dev     # Agent demo on :3000
pnpm --filter @pincerpay/core typecheck     # Typecheck core
```

## Architecture

On-chain payment gateway for the agentic economy. No card rails — pure stablecoin settlement.

### Protocol Stack
```
Discovery (UCP) → Trust (AP2) → Settlement (x402) → Chain Abstraction (Solana | Base | Polygon)
```

- **x402**: HTTP 402-based USDC payments. Agent gets 402 challenge → signs tx → Facilitator verifies + broadcasts → merchant delivers resource.
- **AP2**: Mandate-based authorization. Intent Mandates (autonomous spending limits), Cart Mandates (human approval for high-value), Payment Mandates (execution-level).
- **UCP**: `/.well-known/ucp` manifest for agent-readable commerce discovery. Declares supported chains, tokens, and PincerPay handler.
- **A2A x402 Extension**: "Double-Lock" — Facilitator only broadcasts x402 tx if accompanying AP2 mandate is valid.

### Key Standards
- **Squads SPN**: Solana session keys — decentralized policy co-signer for agent sub-accounts (primary)
- **Kora**: Solana token-fee txns — agents pay fees in USDC, not SOL (primary)
- **ERC-7715**: EVM session keys — scoped permissions (contracts, limits, expiry) for agent wallets (optional/EVM)
- **ERC-8004 (KYA)**: On-chain agent identity (NFT), reputation (Trust Score), validation (TEE/zkML proofs)

### Key Mechanisms
- **Gas Passthrough**: PincerPay never subsidizes gas. Gas costs are paid by agents (via Kora on Solana, EIP-2771/4337 meta-txns on EVM) using USDC — deducted from the payment amount or charged separately. PincerPay facilitates, never funds.
- **Optimistic Finality**: Sub-$1 txns release after mempool broadcast (~200ms)
- **Compliance-as-a-Service**: OFAC screening + reputation gating at Facilitator layer

### Phased Rollout (Solana-First)
1. **Phase 1 (MVP)** — Complete: x402 facilitator + multi-chain USDC (Solana primary, Base + Polygon optional) + merchant dashboard
2. **Phase S1 (Solana Parity)** — Complete: Solana-first defaults, confirmation worker, gas tracking, dashboard Solana support
3. **Phase S2 (Kora + Squads)**: Kora gasless txns + Squads SPN session keys + on-chain spending policies
4. **Phase S3 (On-Chain Facilitator)**: Anchor program for Solana settlement, hybrid facilitator (on-chain Solana + viem EVM)
5. **Phase S4 (Transfer Hooks + Compliance)**: Anchor compliance program, OFAC screening, Transfer Hook registration
6. **Phase S5 (Advanced)**: Micropayment batching (ZK compression), CCTP v2 EVM→Solana bridging, agent identity (DIDs + trust scores)

## Current Status
See `STATUS.md` for current work and `CHANGELOG.md` for completed milestones. Both are gitignored (internal only).

## Backlog Tracking

**Source of truth: [GitHub Issues](https://github.com/ds1/pincerpay/issues).**

### Auto-sync rules
- When completing work that corresponds to a GitHub Issue, close the issue: `gh issue close <number>`
- When closing an issue, also check off the corresponding line in `_planning/backlog.md`
- When creating new backlog items, create a GitHub Issue first, then add to `_planning/backlog.md` with the issue number
- Reference issue numbers in commit messages where relevant (e.g., `feat: webhook retry logic, closes #17`)
- On session start, if asked to review backlog, check for stale items: `gh issue list --state open --limit 50`
