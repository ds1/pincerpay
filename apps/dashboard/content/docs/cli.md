---
title: "@pincerpay/cli"
description: "Frictionless terminal-only CLI for PincerPay merchant onboarding. No browser required."
order: 3.4
section: SDKs
---

`@pincerpay/cli` is the terminal interface for PincerPay merchant onboarding. Sign up, verify email, generate non-custodial wallets, create merchant records, mint API keys, manage sessions — all from the command line. No browser interaction at any point.

## Install

Use directly with `npx`:

```bash
npx @pincerpay/cli signup
```

Or install globally:

```bash
npm install -g @pincerpay/cli
pincerpay signup
```

## Quick start

Three commands from zero to live:

```bash
npx @pincerpay/cli signup
npx @pincerpay/cli bootstrap-merchant --name "Acme Co" --chains "solana,polygon"
# (paste env vars into `vercel env add`)
```

## Account commands

### `signup`

Create a new PincerPay account. Walks through email + password + email-OTP verification entirely in the terminal.

```bash
pincerpay signup [--email <email>]
```

After successful verification, credentials are saved at `~/.pincerpay/credentials.json` and the CLI is ready for authenticated operations.

### `login`

Sign in to an existing account.

```bash
pincerpay login [--email <email>]
```

### `logout`

Revoke the CLI session server-side and delete local credentials.

```bash
pincerpay logout
```

### `whoami`

Show the currently authenticated user, session, and merchant.

```bash
pincerpay whoami
```

### `recover`

Send a password recovery code to your email.

```bash
pincerpay recover [--email <email>]
```

### `reset-password`

Reset your password using the recovery code from email.

```bash
pincerpay reset-password [--email <email>]
```

### `change-password`

Change your password while logged in. Revokes all other CLI sessions for the account.

```bash
pincerpay change-password
```

## Wallet commands

### `create-wallets`

Generate non-custodial Solana + EVM wallets from a single BIP-39 mnemonic. Pure client-side crypto — no auth, never talks to PincerPay.

```bash
pincerpay create-wallets [--strength 12|24] [--mnemonic <words>] [--json] [--no-private-keys]
```

Phantom-compatible Solana derivation at `m/44'/501'/0'/0'`. MetaMask-compatible EVM derivation at `m/44'/60'/0'/0/0`. The mnemonic recovers both wallets in those clients.

## Merchant onboarding

### `bootstrap-merchant`

End-to-end onboarding in one command. Generates wallets, creates the merchant record, mints an initial API key. Idempotent — safe to re-run; finds an existing merchant for the account if one exists.

```bash
pincerpay bootstrap-merchant \
  --name "Acme Co" \
  [--chains "solana,polygon"] \
  [--webhook-url <url>] \
  [--api-key-label "default"] \
  [--mnemonic <words>] \
  [--strength 12|24] \
  [--skip-api-key]
```

Output ends with a paste-ready env-var block.

## API key commands

```bash
pincerpay api-keys create [--label <label>]   # mint a new pp_live_* key
pincerpay api-keys list                        # list all keys for the merchant
pincerpay api-keys rotate <id>                 # atomically mint new + revoke old
pincerpay api-keys revoke <id>                 # revoke a key
```

## Wallet management

```bash
pincerpay wallet set --solana <addr> --evm <addr> [--force]
```

Updates the merchant's per-chain wallet addresses. **Confirms before committing** — wallet rotation redirects all future settlements. Audit-logged server-side.

## Session management

```bash
pincerpay sessions list                       # active CLI sessions
pincerpay sessions revoke <id>                # revoke a session by id
```

## Env block

```bash
pincerpay env                                  # print env-var template
```

Prints an env-var template based on the current merchant config. Uses public values (addresses, API key prefix) only — raw API keys are shown only once at creation time and must come from your password manager.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PINCERPAY_FACILITATOR_URL` | `https://facilitator.pincerpay.com` | Override facilitator endpoint |

Or pass `--facilitator-url <url>` to any command.

## Security

- Tokens stored at `~/.pincerpay/credentials.json` with `0600` permissions on POSIX, current-user ACL on Windows.
- Atomic writes (temp file + rename) prevent corruption from concurrent CLI invocations.
- 30-day default token lifetime. Refresh-on-expiry — re-run `pincerpay login`.
- HMAC-SHA256 server-side hashing with pepper.
- All operations audit-logged.

## Companion packages

- [`@pincerpay/onboarding`](https://www.npmjs.com/package/@pincerpay/onboarding) — pure crypto for wallet generation. The CLI's `create-wallets` is a thin wrapper.
- [`@pincerpay/mcp`](https://www.npmjs.com/package/@pincerpay/mcp) — same operations exposed as MCP tools. Picks up the same `~/.pincerpay/credentials.json` automatically.
- [`@pincerpay/merchant`](https://www.npmjs.com/package/@pincerpay/merchant) — Hono middleware for accepting payments after onboarding.
