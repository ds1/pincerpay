# PincerPay - Agent Guide

On-chain payment gateway for the agentic economy. Agents pay USDC for HTTP resources via the x402 protocol.

## Repo Structure

```
pincerpay/
├── apps/
│   ├── facilitator/     # x402 facilitator service (Hono + Node.js)
│   └── dashboard/       # Merchant dashboard (Next.js 15 + Supabase Auth)
├── packages/
│   ├── core/            # Shared types, chain configs, constants
│   ├── db/              # Drizzle ORM schema + PostgreSQL migrations
│   ├── solana/          # Kora gasless txns + Squads smart accounts
│   ├── program/         # Anchor program client for on-chain settlement
│   ├── agent/           # Agent SDK (fetch wrapper with auto x402 payment)
│   ├── merchant/        # Merchant SDK (Express + Hono + Next.js middleware)
│   ├── onboarding/      # Non-custodial wallet generation + merchant bootstrap helpers
│   ├── cli/             # Terminal-only merchant onboarding (`npx @pincerpay/cli`)
│   └── mcp/             # MCP server for AI agent tool integration
├── examples/
│   ├── express-merchant/ # Express merchant demo
│   └── agent-weather/    # Agent weather API demo
└── packages/solana-program/ # Anchor on-chain program (Rust)
```

## Package Dependency Graph

```
@pincerpay/core          (no internal deps)
  ├── @pincerpay/db          (core)
  ├── @pincerpay/solana      (core)
  ├── @pincerpay/program     (core)
  ├── @pincerpay/agent       (core, solana)
  ├── @pincerpay/merchant    (core)
  ├── @pincerpay/onboarding  (core, db)
  ├── @pincerpay/cli         (onboarding)
  └── @pincerpay/mcp         (core, onboarding)
```

## Quick Start

```bash
# Install all dependencies
pnpm install

# Build all packages (respects dependency order via Turborepo)
pnpm build

# Run all tests
pnpm test

# Typecheck all packages
pnpm typecheck

# Dev mode (all services)
pnpm dev
```

## Individual Package Commands

```bash
pnpm --filter @pincerpay/facilitator dev    # Facilitator on :4402
pnpm --filter @pincerpay/dashboard dev      # Dashboard on :3000
pnpm --filter @pincerpay/core typecheck     # Typecheck core
pnpm --filter @pincerpay/agent test         # Test agent SDK
```

## Database

```bash
pnpm db:generate   # Generate Drizzle migrations from schema
pnpm db:push       # Push schema to database
pnpm db:seed       # Seed test data
```

Requires `DATABASE_URL` env var (PostgreSQL connection string, Supabase recommended).

## Architecture

```
Agent -> HTTP 402 Challenge -> Sign USDC Transfer -> PincerPay Facilitator -> Blockchain -> Merchant
```

1. Merchant adds `@pincerpay/merchant` middleware to Express/Hono routes
2. Agent hits protected endpoint, gets HTTP 402 with payment requirements
3. Agent signs a USDC transfer transaction using `@pincerpay/agent` (spending policies use base units with 6 decimals — $1.00 = "1000000")
4. PincerPay facilitator verifies signature, broadcasts to chain, confirms settlement
5. Merchant delivers the resource

## Supported Chains

- **Solana** (primary): devnet + mainnet. Kora integration for gasless txns (agents pay fees in USDC).
- **Base** (EVM, optional): Sepolia testnet + mainnet
- **Polygon** (EVM, optional): Amoy testnet + mainnet

## Key Protocols

- **x402**: HTTP 402-based USDC payments (Coinbase). Core settlement protocol.
- **AP2**: Mandate-based authorization (Google). Trust layer.
- **UCP**: `/.well-known/ucp` agent-readable commerce discovery.
- **Squads SPN**: Solana session keys for agent sub-accounts with spending limits.
- **Kora**: Solana gasless transactions. Agents pay fees in USDC instead of SOL.

## Environment Variables

### Facilitator (`apps/facilitator/.env`)
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SOLANA_PRIVATE_KEY` - Facilitator wallet (base58 keypair, required unless Kora)
- `FACILITATOR_PRIVATE_KEY` - EVM wallet (0x-prefixed, optional)
- `SOLANA_NETWORKS` - CAIP-2 network IDs (default: Solana devnet)
- `EVM_NETWORKS` - CAIP-2 EVM networks (optional)
- `RPC_URLS` - JSON map of network-to-RPC-URL
- `KORA_RPC_URL` - Kora signer node for gasless Solana
- `ANCHOR_PROGRAM_ID` - On-chain settlement program
- `OFAC_ENABLED` - Enable OFAC compliance screening
- `LOGTAIL_SOURCE_TOKEN` - Better Stack log aggregation
- `TOKEN_PEPPER` - HMAC pepper (min 32 chars) for `cli_sessions` + API key hashing. See [Auth & secrets](#auth--secrets).
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` - Supabase project (required for CLI onboarding)
- `SUPABASE_SMTP_CONFIGURED` - Set `true` only once the Supabase project has a working SMTP provider; otherwise `/v1/onboarding/auth/signup` returns `503 email_delivery_unavailable` instead of falsely reporting an OTP was sent.

### Dashboard (`apps/dashboard/.env.local`)
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `TOKEN_PEPPER` - Required for the dashboard to mint HMAC API keys; **must be byte-for-byte identical** to the facilitator's value (see [Auth & secrets](#auth--secrets)).

## Conventions

- **Package manager**: pnpm 10+ (strict, no hoisting)
- **Module system**: ESM everywhere. Use `.js` extensions in imports.
- **TypeScript**: Strict mode. `NodeNext` module resolution for packages.
- **Testing**: Vitest for unit/integration tests
- **Linting**: TypeScript strict + `tsc --noEmit`
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **Branching**: `feat/description`, `fix/description`, `chore/description`
- **CI**: GitHub Actions (typecheck, test, build)

## Auth & secrets

- **API keys** (`pp_live_*` / `pp_test_*`) and **CLI sessions** (`pp_cli_*`) are stored
  hashed, never in plaintext. Both use **HMAC-SHA256 with the `TOKEN_PEPPER` server
  pepper**. API keys carry a legacy **SHA-256 fallback** (`api_keys.key_hash`) for keys
  minted before migration `0004`; verification tries HMAC first, then SHA-256.
- **All services that mint API keys** (facilitator onboarding route, dashboard server
  actions, `scripts/*` bootstrap/admin tools) must share the **same** `TOKEN_PEPPER`, or
  the keys they create won't authenticate. Hashing goes through the shared helpers in
  `@pincerpay/db` (`hashNewApiKey`, `apiKeyHashHmac`, `apiKeyHashSha256`, `getApiKeyPepper`) —
  do not re-implement hashing at a mint site.
- When `TOKEN_PEPPER` is unset, helpers fall back to legacy SHA-256 so key creation never
  hard-fails (the key is still usable via the fallback lookup).

## Key Files

- `apps/facilitator/src/index.ts` - Facilitator entry point
- `apps/facilitator/src/routes/settle.ts` - Settlement endpoint
- `apps/facilitator/src/config.ts` - Environment config (Zod validated)
- `packages/core/src/chains/index.ts` - Chain configurations (USDC addresses)
- `packages/db/src/schema/` - Database table definitions
- `packages/solana/src/squads/` - Squads smart account integration
- `packages/solana/src/kora/` - Kora gasless transaction integration
- `packages/onboarding/src/wallets.ts` - Non-custodial BIP-39 wallet generation (Phantom + MetaMask compatible)
- `packages/onboarding/src/merchant.ts` - Merchant + API key creation helpers
- `packages/db/src/hashing.ts` - Shared API-key hashing helpers (HMAC + SHA-256 fallback)
- `scripts/bootstrap-merchant.mts` - End-to-end CLI: wallet generation + merchant row + API key
- `scripts/create-wallets.mts` - Wallet generation only (no DB)
- `scripts/create-api-key.mts` - Mint a key for an existing merchant
- `apps/facilitator/scripts/api-keys-migrate-cleanup.mts` - Revoke leftover SHA-256-only keys after the HMAC cutover window

## Surfacing work that needs @ds1

@ds1 may miss things buried in long chat transcripts. So whenever work is
**blocked on @ds1** — it needs a credential/access only they have (prod
`DATABASE_URL`, npm/Vercel/Railway/CI secrets, GitHub Actions), a decision only
they can make, or any action only they can take — do not let it live only in
chat. Create a GitHub issue and **assign it to `ds1`** so it shows up in their
queue.

- One consolidated issue per batch of related blockers is fine (see #140 as the
  template): a checklist, ordered by urgency, with enough context to act without
  scrolling back, and links to any existing tracking issues instead of
  duplicating them.
- Label by area/severity using the repo's existing labels (e.g. `priority: high`,
  `infra`, `security`).
- Note inside the issue which items are being handled without them, so the
  assigned list is purely "needs @ds1".
- Still summarize the blockers in chat too — the issue is the durable backstop,
  not a replacement for telling them.
