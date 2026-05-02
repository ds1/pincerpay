---
title: "Merchant Onboarding"
description: "Sign up for PincerPay, generate wallets, and mint API keys — entirely from the terminal. No browser required."
order: 1.4
section: Guides
---

PincerPay merchants get from zero to live in three commands. The flow is **terminal-only**: signup, email verification, wallet generation, merchant creation, and API key minting all happen via CLI prompts. No browser, no dashboard click-through.

> **Non-custodial.** PincerPay never sees your mnemonic or private keys. Wallet generation runs entirely on your machine. Only public addresses are persisted server-side.

## Quick start

```bash
# 1. Create an account.
npx @pincerpay/cli signup

# 2. Generate wallets, create merchant, mint API key.
npx @pincerpay/cli bootstrap-merchant --name "Acme Co" --chains "solana,polygon"
```

Done. The second command prints a paste-ready env-var block:

```
PINCERPAY_API_KEY=pp_live_...
PINCERPAY_MERCHANT_ADDRESS_SOLANA=...
PINCERPAY_MERCHANT_ADDRESS_POLYGON=0x...
```

Pipe those into `vercel env add` (or your env manager) and your app accepts agent payments.

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
```

The OTP is a 6-digit code delivered by email. You paste it back into the CLI. No URL clicks, no port binding, no browser tabs.

After signup the CLI saves a long-lived bearer token at `~/.pincerpay/credentials.json` (with `0600` permissions on POSIX). All subsequent commands use that token automatically.

## Three paths

| Path | When to use |
|------|-------------|
| `@pincerpay/cli` (CLI) | First-time setup, server provisioning, multi-environment workflow, CI |
| `@pincerpay/mcp` (MCP) | LLM-driven onboarding inside Claude Code, Cursor, Windsurf, etc |
| `@pincerpay/onboarding` (library) | Custom signup flows you build yourself |

All three sit on top of the same authenticated facilitator API. After running `pincerpay login`, the MCP server picks up the same `~/.pincerpay/credentials.json` automatically — one auth ceremony for everything.

## CLI commands

### Account lifecycle

```bash
pincerpay signup                  # create account
pincerpay login                   # sign in to existing account
pincerpay logout                  # revoke this CLI session
pincerpay whoami                  # show user + merchant info
pincerpay recover                 # send password recovery code
pincerpay reset-password          # use code to reset password
pincerpay change-password         # change password while logged in
```

### Onboarding (one-shot)

```bash
pincerpay bootstrap-merchant \
  --name "Acme Co" \
  --chains "solana,polygon" \
  [--webhook-url https://your-app.com/webhooks/pincerpay] \
  [--api-key-label "production"]
```

Generates non-custodial wallets, creates the merchant record (idempotent — safe to re-run), mints an initial API key, and prints the env-var block. **All in one command.**

### Wallet-only (no signup needed)

```bash
pincerpay create-wallets [--strength 12|24] [--json] [--no-private-keys]
```

Pure crypto — runs locally, never talks to PincerPay. Useful for previewing addresses before signup, or for any merchant who wants to bring their own wallet to the dashboard flow.

### Manage existing merchant

```bash
pincerpay api-keys create [--label]
pincerpay api-keys list
pincerpay api-keys rotate <id>
pincerpay api-keys revoke <id>

pincerpay wallet set --solana <addr> --evm <addr>

pincerpay sessions list
pincerpay sessions revoke <id>

pincerpay env                     # print env-var template
```

## MCP commands

If you've connected `@pincerpay/mcp` to your AI client, the same operations are available as MCP tools:

```
> Generate non-custodial PincerPay wallets for me.
   → bootstrap-wallets

> I just ran `pincerpay login`. Bootstrap a merchant called "Acme Co".
   → bootstrap-merchant (public mode, uses ~/.pincerpay/credentials.json)

> Show me my current PincerPay setup.
   → whoami

> I'm getting auth errors from the onboarding tools.
   → login-instructions
```

See the [MCP server docs](/docs/mcp-server) for the full tool list.

## Security model

- **Non-custodial wallets.** BIP-39 mnemonic generation runs client-side via `@pincerpay/onboarding`. Phantom-compatible Solana derivation (`m/44'/501'/0'/0'`) and MetaMask-compatible EVM derivation (`m/44'/60'/0'/0/0`) from a single mnemonic.
- **Email-OTP verification.** Signup verifies your email via a 6-digit code (Supabase `auth.verifyOtp`), not a click-link. The OTP is the authentication; the email address is just the delivery channel.
- **Bearer tokens.** Successful signup or login mints a `pp_cli_*` token with a 30-day default lifetime. Stored in `~/.pincerpay/credentials.json` (`0600` perms on POSIX, current-user ACL on Windows). Tokens are HMAC-SHA256 hashed server-side with a server pepper.
- **Audit logging.** Every signup, login, key creation, wallet change, and session revocation writes a row to `audit_events`. Surfaced via `pincerpay sessions list` and the dashboard security page.
- **Self-revocation.** `pincerpay logout` calls the server-side revoke endpoint before deleting local credentials, so a compromised laptop can be locked out by running `pincerpay logout` from any other authenticated machine.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PINCERPAY_FACILITATOR_URL` | `https://facilitator.pincerpay.com` | Override facilitator endpoint |

Or pass `--facilitator-url <url>` to any command.

## Recovery

If you lose access to your credentials:

1. Run `pincerpay recover --email <your-email>` from any machine.
2. Check inbox for a recovery code.
3. Run `pincerpay reset-password --email <your-email>` and paste the code.
4. Run `pincerpay login` with the new password.

If you lose your **mnemonic**, USDC sent to those wallet addresses is unrecoverable. Save the mnemonic in a password manager when `bootstrap-merchant` prints it.

## Troubleshooting

**"Not logged in. Run `pincerpay login` first."**
Your credentials file is missing or expired. Run `pincerpay login` (or `pincerpay signup`).

**"token_checksum_invalid" or "token_format_invalid"**
The credentials file is corrupted. Delete `~/.pincerpay/credentials.json` and re-authenticate.

**"email_not_verified"**
You haven't completed the OTP step. Run `pincerpay signup` again with the same email — Supabase will email a fresh code.

**Email never arrives**
Check spam. Recovery emails come from `noreply@<your-supabase-project>.supabase.co`. Production deployments configure a custom email sender in the Supabase dashboard.

## Companion docs

- [@pincerpay/cli](/docs/cli) — full CLI reference
- [MCP server](/docs/mcp-server) — onboarding via LLM tools
- [Merchant SDK](/docs/merchant-sdk) — using your API key + addresses to accept payments
- [Quickstart: Merchant](/docs/quickstart-merchant) — end-to-end first-payment walkthrough
