# Contributing to PincerPay

Thanks for your interest in contributing to PincerPay.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/ds1/pincerpay.git
cd pincerpay

# Install dependencies (requires pnpm 10+)
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Typecheck
pnpm typecheck

# Start dev servers
pnpm dev
```

## Prerequisites

- Node.js 22+
- pnpm 10+

## Project Structure

```
apps/
  facilitator/    # x402 facilitator server (Hono)
  dashboard/      # Merchant dashboard (Next.js 15)
  agent-demo/     # Interactive demo (demo.pincerpay.com)
packages/
  core/           # Shared types, chain configs, constants
  db/             # Drizzle ORM schema
  solana/         # Kora gasless txns, Squads smart accounts
  program/        # Anchor program client
  agent/          # Agent SDK (fetch wrapper)
  merchant/       # Merchant SDK (Express/Hono/Next.js middleware)
  mcp/            # MCP server for AI assistants
examples/
  express-merchant/  # Express merchant demo
  agent-weather/     # Agent weather API demo
  nextjs-merchant/   # Next.js merchant demo
```

## Making Changes

1. Fork the repo and create a branch: `feat/description`, `fix/description`, or `chore/description`
2. Make your changes
3. Add a changeset (`pnpm changeset`) describing any consumer-facing change to a published package (`core`, `agent`, `merchant`, `mcp`). These four release as one linked set - see [RELEASING.md](RELEASING.md).
4. Run `pnpm typecheck && pnpm test && pnpm build` to verify
5. Commit using conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
6. Open a pull request against `master`

## Conventions

- **ESM everywhere**: use `.js` extensions in TypeScript imports
- **Module resolution**: `NodeNext` in tsconfig for packages
- **USDC amounts**: always in base units (6 decimals). 1 USDC = `1000000`
- **Chain IDs**: CAIP-2 format (e.g., `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)
- **Package manager**: always `pnpm`, never npm or yarn

## What to Contribute

Good first contributions:
- Bug fixes with reproduction steps
- Documentation improvements
- New examples
- Test coverage improvements

Larger contributions (please open an issue first):
- New chain support
- Protocol integrations
- SDK features

## Releasing

`core`, `agent`, `merchant`, and `mcp` publish to npm as one linked set and
always share a version (`merchant` pins `core` exact). See
[RELEASING.md](RELEASING.md) for the coupling contract, the changeset-driven
publish flow, and how to cut a `next` dist-tag prerelease.

## Questions?

Open a [GitHub Discussion](https://github.com/ds1/pincerpay/discussions) or file an issue.
