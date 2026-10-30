# @pincerpay/cli

## 0.3.4

### Patch Changes

- [#173](https://github.com/ds1/pincerpay/pull/173) [`c4ecadc`](https://github.com/ds1/pincerpay/commit/c4ecadc965784168a4911d71f3f6382066a5bbb8) Thanks [@ds1](https://github.com/ds1)! - Fix MCP and SDK bugs found in the 2026-10 audit:

  - MCP `get-settlement-metrics` calls the facilitator's unauthenticated `/metrics` route (was `/v1/metrics`, which returned 401). `FACILITATOR_ROUTES.metrics` is now `/metrics`.
  - MCP `scaffold-x402-middleware` generates one handler per paywalled route, with paywall keys and handler paths that match (previously every route pointed at an `/example` handler and 404'd after payment).
  - MCP `validate-payment-config` reports schema and route errors together, and treats unknown chains, missing wallets and wrong-format addresses as errors.
  - Agent spending policies enforce `allowedMerchants` and `allowedChains` before signing. `AgentConfig.facilitatorUrl` is deprecated (unused).
  - CLI `--version` and the MCP server version are read from package.json.

- Updated dependencies []:
  - @pincerpay/onboarding@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies [[`7008fb4`](https://github.com/ds1/pincerpay/commit/7008fb47f9ef07810f7abd81e60fce5b565be8ab)]:
  - @pincerpay/onboarding@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @pincerpay/onboarding@0.3.2
