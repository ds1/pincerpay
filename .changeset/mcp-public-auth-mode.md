---
"@pincerpay/mcp": minor
---

Onboarding tools (`bootstrap-merchant`, `create-api-key`, `list-merchants`) now support a **public auth mode** in addition to the existing admin mode.

- **Admin mode** (existing): `DATABASE_URL` is set on the MCP server. Tools write directly to the PincerPay database. Use for self-hosted deployments.
- **Public mode** (new): `~/.pincerpay/credentials.json` exists (created by `npx @pincerpay/cli signup` or `login`). Tools call the authenticated facilitator API using the bearer token. Use for normal merchant workflows.

The MCP server resolves the mode at each tool call — no restart needed when a user runs `pincerpay login` in a terminal.

Two new tools:

- `whoami` — diagnostic that returns the current auth mode, user, and merchant info.
- `login-instructions` — returns the exact terminal commands to authenticate the MCP server.

Tool count: 24 → 26. Unchanged behavior for existing admin-mode users.
