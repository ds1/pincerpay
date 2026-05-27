---
"@pincerpay/merchant": minor
"@pincerpay/mcp": minor
"@pincerpay/core": patch
"@pincerpay/agent": patch
---

Stabilize consumer-facing contracts based on integration feedback.

`@pincerpay/merchant` now re-exports the middleware context contract
(`PincerPayContextVariables`, `PincerPayPaymentInfo`) from the package root, not
just from `@pincerpay/merchant/nextjs`. The middleware sets exactly one Hono
context key, `pincerpay`; import the type instead of duck-typing the shape and
any future change is a compile error. (There is no `agentWallet` context key.)

`@pincerpay/mcp` tools now carry MCP `ToolAnnotations`
(`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`), and the
irreversible `delete-paywall` tool requires `confirm: true` before it will run.

Docs: added `RELEASING.md` (version-coupling contract - these packages release as
one linked set and `merchant` pins `core` exact), per-package `CHANGELOG.md`
files (previously gitignored and missing from npm), a canonical x402 OpenAPI
security-scheme snippet, a test-vs-live API key reference, and MCP authoring
conventions.
