# PincerPay

On-chain payment gateway for the agentic economy.

## Tech Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Runtime:** Node.js 22+ (TypeScript)
- **Facilitator:** Hono + @x402/core + @x402/evm + viem
- **Dashboard:** Next.js 15 + Tailwind CSS v4 + Supabase Auth
- **Database:** PostgreSQL (Supabase) + Drizzle ORM
- **SDKs:** @pincerpay/merchant (Express/Hono), @pincerpay/agent (fetch wrapper)

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
pnpm --filter @pincerpay/core typecheck     # Typecheck core
```

## Architecture

On-chain payment gateway for the agentic economy. No card rails — pure stablecoin settlement.

### Protocol Stack
```
Discovery (UCP) → Trust (AP2) → Settlement (x402) → Chain Abstraction (Base | Solana | Polygon)
```

- **x402**: HTTP 402-based USDC payments. Agent gets 402 challenge → signs tx → Facilitator verifies + broadcasts → merchant delivers resource.
- **AP2**: Mandate-based authorization. Intent Mandates (autonomous spending limits), Cart Mandates (human approval for high-value), Payment Mandates (execution-level).
- **UCP**: `/.well-known/ucp` manifest for agent-readable commerce discovery. Declares supported chains, tokens, and PincerPay handler.
- **A2A x402 Extension**: "Double-Lock" — Facilitator only broadcasts x402 tx if accompanying AP2 mandate is valid.

### Key Standards
- **ERC-8004 (KYA)**: On-chain agent identity (NFT), reputation (Trust Score), validation (TEE/zkML proofs)
- **ERC-7715**: EVM session keys — scoped permissions (contracts, limits, expiry) for agent wallets
- **Squads SPN**: Solana session keys — decentralized policy co-signer for agent sub-accounts
- **Kora**: Solana token-fee txns — agents pay fees in USDC, not SOL

### Key Mechanisms
- **Gas Passthrough**: PincerPay never subsidizes gas. Gas costs are paid by agents (via EIP-2771/4337 meta-txns on EVM, Kora on Solana) using USDC — deducted from the payment amount or charged separately. PincerPay facilitates, never funds.
- **Optimistic Finality**: Sub-$1 txns release after mempool broadcast (~200ms)
- **Compliance-as-a-Service**: OFAC screening + reputation gating at Facilitator layer

### Phased Rollout
1. **Phase 1 (MVP)**: x402 facilitator + multi-chain USDC (Base, Solana, Polygon) + merchant dashboard
2. **Phase 2**: AP2 mandates + UCP handler + micropayment batching + ERC-7715/SPN session keys
3. **Phase 3**: ERC-8004 agent identity + escrow + compliance layer + optional fiat off-ramp

## Current Status
See `STATUS.md` for current work and `CHANGELOG.md` for completed milestones.
