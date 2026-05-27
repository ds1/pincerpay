# @pincerpay/agent

> **Version coupling.** `@pincerpay/core`, `@pincerpay/agent`, `@pincerpay/merchant`,
> and `@pincerpay/mcp` are released as one linked set and always share the same
> version number - upgrade them together. `@pincerpay/agent` depends on a matching
> `@pincerpay/core`. See [RELEASING.md](../../RELEASING.md) for the full contract.

## 0.9.0

### Patch Changes

- README no longer documents the removed `SolanaSmartAgent` class, its methods,
  or its config. The documented surface now matches what actually ships
  (`PincerPayAgent`). The `.fetch`-only wrapper surface is unchanged.

> Released in lockstep with `@pincerpay/core`, `@pincerpay/merchant`, and
> `@pincerpay/mcp` 0.9.0. (Version 0.7.0 was skipped; the previous release was
> 0.8.0.)
