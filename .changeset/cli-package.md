---
"@pincerpay/cli": minor
---

Initial release of `@pincerpay/cli`. Frictionless merchant onboarding via the terminal — no browser required at any point.

Commands:

- `pincerpay signup` — create an account via email + password + OTP. Walks through the verification step entirely in the terminal.
- `pincerpay login` — sign in to an existing account.
- `pincerpay logout` — revoke the CLI session server-side and delete local credentials.
- `pincerpay whoami` — show the logged-in user, session, and merchant.
- `pincerpay recover` / `pincerpay reset-password` / `pincerpay change-password` — password lifecycle, all CLI/MCP-only.
- `pincerpay create-wallets` — non-custodial BIP-39 wallet generation (Phantom + MetaMask compatible). No auth required.
- `pincerpay bootstrap-merchant` — end-to-end onboarding: generate wallets, create merchant record, mint API key, output env-var block.
- `pincerpay api-keys` (create / list / rotate / revoke) — manage merchant API keys.
- `pincerpay wallet set` — update merchant wallet addresses with confirmation prompt.
- `pincerpay env` — print env-var template from current merchant config.
- `pincerpay sessions` (list / revoke) — manage active CLI sessions.

Credentials stored at `~/.pincerpay/credentials.json` with `0600` permissions on POSIX. Tokens have a 30-day default lifetime and can be revoked from the dashboard's security page or via `pincerpay sessions revoke`.

Companion to the new `/v1/onboarding/*` endpoints on the facilitator. Talks to `https://facilitator.pincerpay.com` by default; override with `PINCERPAY_FACILITATOR_URL` or `--facilitator-url`.
