# @pincerpay/cli

[![npm](https://img.shields.io/npm/v/@pincerpay/cli?style=flat-square)](https://www.npmjs.com/package/@pincerpay/cli)
[![license](https://img.shields.io/npm/l/@pincerpay/cli?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Frictionless CLI for [PincerPay](https://pincerpay.com) merchant onboarding. Sign up, verify email, create your merchant, mint API keys, manage wallets — all from the terminal. **No browser required at any point.**

## Quick start

```bash
# 1. Sign up (or skip to step 2 if you already have an account).
npx @pincerpay/cli signup

# 2. Log in (only needed if you didn't just sign up).
npx @pincerpay/cli login

# 3. Generate non-custodial wallets, create your merchant, mint your first API key.
npx @pincerpay/cli bootstrap-merchant --name "Acme Co" --chains "solana,polygon"
```

The last command outputs an env-var-ready block:

```
PINCERPAY_API_KEY=pp_live_...
PINCERPAY_MERCHANT_ADDRESS_SOLANA=...
PINCERPAY_MERCHANT_ADDRESS_POLYGON=0x...
```

Pipe that into `vercel env add` (or your env manager) and you're live.

## How signup works (no browser)

```
$ npx @pincerpay/cli signup
Email: dan@example.com
Password (8+ chars): ••••••••
Confirm password: ••••••••

We sent a verification code to dan@example.com.
Check your inbox and paste the code below.

Verification code: 123456

✓ Verified and signed in as dan@example.com.
  Credentials saved to /Users/dan/.pincerpay/credentials.json.
  Token expires 2026-06-01 14:23:11.

Next: run `pincerpay bootstrap-merchant` to create your merchant profile.
```

The OTP is delivered by email; you paste it back into the CLI. No URL clicks. No port binding. No browser tabs to close.

## Commands

### Auth

| Command | Description |
|---------|-------------|
| `pincerpay signup [--email]` | Create an account. Walks through email + password + OTP. |
| `pincerpay login [--email]` | Sign in to an existing account. |
| `pincerpay logout` | Revoke the CLI session and delete local credentials. |
| `pincerpay whoami` | Show the logged-in user, session, and merchant. |
| `pincerpay recover [--email]` | Send a password recovery code to your email. |
| `pincerpay reset-password` | Reset password using the recovery code. |
| `pincerpay change-password` | Change password while logged in. Revokes other sessions. |

### Wallets (no auth required)

| Command | Description |
|---------|-------------|
| `pincerpay create-wallets [--strength 12\|24] [--json] [--no-private-keys]` | Generate non-custodial Solana + EVM wallets from a single BIP-39 mnemonic. Phantom + MetaMask compatible. |

### Merchant onboarding (auth required)

| Command | Description |
|---------|-------------|
| `pincerpay bootstrap-merchant --name <name> [--chains solana,polygon]` | End-to-end: generate wallets, create merchant, mint API key. Outputs env-var block. |
| `pincerpay api-keys create [--label] [--test]` | Mint a new API key. With `--test` the prefix is `pp_test_*`; test keys cannot settle on mainnet chains. |
| `pincerpay api-keys list [--env live\|test]` | List API keys. Filter to a single environment with `--env`. |
| `pincerpay api-keys rotate <id>` | Atomically mint a new key and revoke the old one. |
| `pincerpay api-keys revoke <id>` | Revoke an API key. |
| `pincerpay wallet set --solana <addr> --evm <addr>` | Update merchant wallet addresses. Confirms before committing. |
| `pincerpay env` | Print an env-var template based on current merchant config. |
| `pincerpay sessions list` | List active CLI sessions. |
| `pincerpay sessions revoke <id>` | Revoke a CLI session by id. |

## Security model

- **Non-custodial wallets.** `create-wallets` and `bootstrap-merchant` generate keys client-side. PincerPay never sees your mnemonic or private keys.
- **Email-OTP signup.** Email verification uses a 6-digit code (Supabase `auth.verifyOtp`), not a click-link.
- **Bearer tokens.** After signup/login the facilitator mints a `pp_cli_*` token with a 30-day default expiry. Stored in `~/.pincerpay/credentials.json` with `0600` permissions on POSIX.
- **Audit logging.** Every signup, login, key creation, wallet change, and session revocation writes an `audit_events` row server-side, viewable from the dashboard's security page.
- **Revocation.** `pincerpay logout` revokes the server-side session before deleting local credentials. `pincerpay sessions revoke <id>` revokes any session.

## Configuration

| Environment variable | Default | Purpose |
|---------------------|---------|---------|
| `PINCERPAY_FACILITATOR_URL` | `https://facilitator.pincerpay.com` | Override the facilitator endpoint. |

You can also pass `--facilitator-url <url>` to any command.

## Troubleshooting

**"Not logged in. Run `pincerpay login` first."**
Your credentials file is missing or expired. Run `pincerpay login` (or `pincerpay signup` for new accounts).

**"token_checksum_invalid" or "token_format_invalid"**
The credentials file was corrupted. Delete `~/.pincerpay/credentials.json` and log in again.

**"email_not_verified"**
You haven't completed the OTP step. Run `pincerpay signup` again with the same email — Supabase will email a fresh code.

**Email never arrives**
Check spam. Recovery emails come from `noreply@<your-supabase-project>.supabase.co`. Production deployments should configure a custom email sender in the Supabase dashboard.

## Companion packages

- [`@pincerpay/onboarding`](https://www.npmjs.com/package/@pincerpay/onboarding) — pure crypto for wallet generation. The CLI's `create-wallets` command is a thin wrapper.
- [`@pincerpay/mcp`](https://www.npmjs.com/package/@pincerpay/mcp) — MCP server exposing the same operations as tools to LLMs (Claude, Cursor, etc).
- [`@pincerpay/merchant`](https://www.npmjs.com/package/@pincerpay/merchant) — Hono middleware for accepting payments after onboarding.

## License

MIT
