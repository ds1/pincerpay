# @pincerpay/core

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
