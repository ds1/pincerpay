# @pincerpay/core

## 0.10.3

### Patch Changes

- [#173](https://github.com/ds1/pincerpay/pull/173) [`c4ecadc`](https://github.com/ds1/pincerpay/commit/c4ecadc965784168a4911d71f3f6382066a5bbb8) Thanks [@ds1](https://github.com/ds1)! - Fix MCP and SDK bugs found in the 2026-10 audit:

  - MCP `get-settlement-metrics` calls the facilitator's unauthenticated `/metrics` route (was `/v1/metrics`, which returned 401). `FACILITATOR_ROUTES.metrics` is now `/metrics`.
  - MCP `scaffold-x402-middleware` generates one handler per paywalled route, with paywall keys and handler paths that match (previously every route pointed at an `/example` handler and 404'd after payment).
  - MCP `validate-payment-config` reports schema and route errors together, and treats unknown chains, missing wallets and wrong-format addresses as errors.
  - Agent spending policies enforce `allowedMerchants` and `allowedChains` before signing. `AgentConfig.facilitatorUrl` is deprecated (unused).
  - CLI `--version` and the MCP server version are read from package.json.

## 0.10.0

### Patch Changes

- [#146](https://github.com/ds1/pincerpay/pull/146) [`4f1201e`](https://github.com/ds1/pincerpay/commit/4f1201eeba88b406ee881a04cf0c7d7bd9780cf0) Thanks [@ds1](https://github.com/ds1)! - Stabilize consumer-facing contracts based on integration feedback.

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

> **Version coupling.** `@pincerpay/core`, `@pincerpay/agent`, `@pincerpay/merchant`,
> and `@pincerpay/mcp` are released as one linked set and always share the same
> version number - upgrade them together. `@pincerpay/merchant` pins
> `@pincerpay/core` to an **exact** version. See [RELEASING.md](../../RELEASING.md)
> for the full contract.

## 0.9.0

### Minor Changes

- Remove the orphaned `SolanaSmartAgentConfig` type export. `SolanaSmartAgent`
  and its implementation were removed from the agent SDK during the slim launch,
  but a dangling type was left behind in core. The published type surface now
  matches what actually ships (`PincerPayAgent`).

> Released in lockstep with `@pincerpay/agent`, `@pincerpay/merchant`, and
> `@pincerpay/mcp` 0.9.0. (Version 0.7.0 was skipped; the previous release was
> 0.8.0.)
