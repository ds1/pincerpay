---
title: "Merchant Onboarding"
description: "Generate wallets and provision a PincerPay merchant account from the CLI or MCP — no dashboard click-through."
order: 1.4
section: Guides
---

PincerPay onboarding has two paths: the dashboard wizard at [pincerpay.com/signup](https://pincerpay.com/signup), or the command-line / MCP path documented here. The CLI and MCP routes collapse the multi-step provisioning flow (create wallet, paste address, generate API key, copy values into env vars) into a single command.

> **Non-custodial.** PincerPay never sees your mnemonic or private keys. Wallet generation runs entirely on your machine. The merchant database persists only public addresses.

## When to use which path

| Path             | When to use                                                              |
|------------------|--------------------------------------------------------------------------|
| Dashboard signup | First-time exploration, single merchant, prefer GUI                      |
| CLI scripts      | Server provisioning, multi-environment setup (staging + production), CI  |
| MCP tools        | LLM-driven onboarding inside Claude Code, Cursor, or any MCP client      |

The CLI and MCP paths use the same `@pincerpay/onboarding` library and produce identical output. Pick whichever fits your workflow.

## CLI path

Three commands, all run from the [PincerPay repo](https://github.com/ds1/pincerpay):

### Generate wallets only

Pure client-side crypto. No database, no PincerPay account. Useful when you want to bring your own wallet to the signup flow.

```bash
pnpm create-wallets
```

Output:

```
========================================================================
PincerPay non-custodial wallet bootstrap
========================================================================

Mnemonic (save this — recovery is impossible without it):
  ladder weather seven gravity wagon hunt slender wash hover absent eternal artwork

Solana (Phantom-compatible)
  Address:        5kP9Z...
  Derivation:     m/44'/501'/0'/0'
  Private key:    3xJk...

EVM (MetaMask-compatible — Polygon, Base, Ethereum)
  Address:        0xA1b2C3...
  Derivation:     m/44'/60'/0'/0/0
  Private key:    0x...
```

Flags:

- `--strength 12|24` — mnemonic word count (default 12)
- `--mnemonic "<...>"` — re-derive addresses from an existing mnemonic
- `--json` — emit JSON instead of human-readable text
- `--no-private-keys` — addresses + mnemonic only

### End-to-end merchant bootstrap

Generates wallets, inserts a merchant row, mints an API key, and prints env-var-ready output. Requires `DATABASE_URL` (Supabase Postgres connection string).

```bash
DATABASE_URL=postgresql://... pnpm bootstrap-merchant \
  --name "My Merchant" \
  --auth-user-id <supabase-auth-uuid> \
  --label "Production"
```

Output ends with a paste-ready env block:

```
PINCERPAY_API_KEY=pp_live_a1b2c3...
PINCERPAY_MERCHANT_ADDRESS_SOLANA=5kP9Z...
PINCERPAY_MERCHANT_ADDRESS_POLYGON=0xA1b2C3...
PINCERPAY_WEBHOOK_SECRET=...
```

Pipe that into `vercel env add` (or your env manager) and you're done.

Flags:

- `--name "<name>"` — display name for the merchant (required)
- `--auth-user-id <uuid>` — Supabase Auth user id (required)
- `--mnemonic "<...>"` — use an existing mnemonic instead of generating
- `--strength 12|24` — word count when generating
- `--webhook-url <url>` — webhook delivery URL
- `--label "<label>"` — API key label (default "Bootstrap")
- `--chains <list>` — comma-separated supported chains (default `solana,polygon`)
- `--json` — machine-readable output
- `--dry-run` — generate wallets but skip DB inserts

### API key management for an existing merchant

If you already have a merchant account and just need to mint additional keys (rotation, environment split, third-party integration), skip the bootstrap flow:

```bash
DATABASE_URL=postgresql://... pnpm create-api-key list
DATABASE_URL=postgresql://... pnpm create-api-key create \
  --merchant "<id-or-name>" \
  --label "Staging"
```

The merchant identifier accepts either a UUID or a case-insensitive name. Run `list` first to see ids.

## MCP path

The [PincerPay MCP server](/docs/mcp-server) exposes four onboarding tools.

### Public tools (no auth)

`bootstrap-wallets` runs the same wallet generator as the CLI. Available to any MCP client connected via `npx -y @pincerpay/mcp`.

```
> Generate me a non-custodial PincerPay merchant wallet set with a 12-word mnemonic.
```

Returns a JSON payload with mnemonic + Solana + EVM addresses. Set `includePrivateKeys: true` to also receive the private keys (default false).

### Admin tools (require `DATABASE_URL`)

`bootstrap-merchant`, `create-api-key`, and `list-merchants` write to (or read from) the PincerPay database. They're available only when the MCP server runs with `DATABASE_URL` set in its environment.

In a public deployment of `@pincerpay/mcp`, these tools return a clear error directing users to the dashboard. In a self-hosted / admin deployment, they unlock the full provisioning flow.

```bash
DATABASE_URL=postgresql://... npx @pincerpay/mcp --transport=http --port=3100
```

```
> Bootstrap a new PincerPay merchant called "Acme Co" for auth user <uuid>, then save the env vars to .env.local
```

The LLM calls `bootstrap-merchant`, receives the wallet + key + webhook secret, and writes the env block.

## Security checklist

Before you close the terminal:

- [ ] Saved the mnemonic in a password manager or hardware wallet
- [ ] Saved the API key (`pp_live_...`) — it's not recoverable
- [ ] Saved the webhook secret if you're using webhooks
- [ ] Confirmed env vars are set in the right environment scope (preview vs production on Vercel)
- [ ] Importing the mnemonic into Phantom (Solana) and MetaMask (EVM) reveals the same addresses, if you want a wallet UI

## What's next

- [Quickstart: Merchant](/docs/quickstart-merchant) — wire the addresses + API key into a working server
- [Merchant SDK](/docs/merchant-sdk) — multi-chain configuration reference
- [Testing](/docs/testing) — fund devnet wallets and run an end-to-end payment

## Recovery

If you lose access to the seed but still have the API key, you keep PincerPay-side functionality (paywalls, webhooks). But any USDC settled to the addresses is unreachable without the seed. Plan accordingly:

- For experimentation, use a fresh devnet wallet via `--strength 12` and don't fund it heavily.
- For production, store the mnemonic offline (paper, hardware wallet, multisig).
- For team accounts, treat the mnemonic the same way you'd treat a master signing key — split it, escrow it, or keep it in a hardware wallet.
