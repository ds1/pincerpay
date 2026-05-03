---
"@pincerpay/db": minor
"@pincerpay/core": minor
"@pincerpay/cli": minor
"@pincerpay/onboarding": minor
"@pincerpay/mcp": minor
---

S2: live/test environment scoping. Adds an `environment` Postgres enum and
discriminator column on `api_keys`, `transactions`, `paywalls`, and
`webhook_deliveries`. Splits `merchants.webhook_url` into
`webhook_url_live` + `webhook_url_test` (and the corresponding signing
secrets). Mints a new `pp_test_*` API key prefix; test keys are rejected
with HTTP 403 `test_key_chain_forbidden` on any mainnet chain. Adds a DB
trigger that enforces `transactions.environment === api_keys.environment`
for every insert that supplies `api_key_id`. CLI gains
`pincerpay api-keys create --test` and `pincerpay api-keys list --env live|test`.
Dashboard gains a global Live/Test header toggle (cookie-backed, URL
overridable) that scopes every list view.
