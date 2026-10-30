---
"@pincerpay/core": patch
"@pincerpay/agent": patch
"@pincerpay/mcp": patch
"@pincerpay/cli": patch
---

Fix MCP and SDK bugs found in the 2026-10 audit:

- MCP `get-settlement-metrics` calls the facilitator's unauthenticated `/metrics` route (was `/v1/metrics`, which returned 401). `FACILITATOR_ROUTES.metrics` is now `/metrics`.
- MCP `scaffold-x402-middleware` generates one handler per paywalled route, with paywall keys and handler paths that match (previously every route pointed at an `/example` handler and 404'd after payment).
- MCP `validate-payment-config` reports schema and route errors together, and treats unknown chains, missing wallets and wrong-format addresses as errors.
- Agent spending policies enforce `allowedMerchants` and `allowedChains` before signing. `AgentConfig.facilitatorUrl` is deprecated (unused).
- CLI `--version` and the MCP server version are read from package.json.
