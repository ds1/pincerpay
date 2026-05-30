# @pincerpay/mcp

## 0.10.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [[`4f1201e`](https://github.com/ds1/pincerpay/commit/4f1201eeba88b406ee881a04cf0c7d7bd9780cf0)]:
  - @pincerpay/core@0.10.0
  - @pincerpay/onboarding@0.3.2

> **Version coupling.** `@pincerpay/core`, `@pincerpay/agent`, `@pincerpay/merchant`,
> and `@pincerpay/mcp` are released as one linked set and always share the same
> version number - upgrade them together. See [RELEASING.md](../../RELEASING.md)
> for the full contract.

## 0.9.0

### Patch Changes

- Released in lockstep with `@pincerpay/core` 0.9.0. No changes to the tool,
  resource, or prompt surface in this release.

> Released in lockstep with `@pincerpay/core`, `@pincerpay/agent`, and
> `@pincerpay/merchant` 0.9.0. (Version 0.7.0 was skipped; the previous release
> was 0.8.0.)
