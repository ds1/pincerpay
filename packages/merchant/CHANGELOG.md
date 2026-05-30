# @pincerpay/merchant

> **Version coupling.** `@pincerpay/core`, `@pincerpay/agent`, `@pincerpay/merchant`,
> and `@pincerpay/mcp` are released as one linked set and always share the same
> version number - upgrade them together. `@pincerpay/merchant` pins
> `@pincerpay/core` to an **exact** version, so a `merchant` bump always implies a
> matching `core` bump. See [RELEASING.md](../../RELEASING.md) for the full contract.

## 0.9.0

### Patch Changes

- Released in lockstep with `@pincerpay/core` 0.9.0. No changes to the middleware
  surface or the request-context contract.

### Context contract

The middleware sets exactly one Hono context variable, `pincerpay`, typed as
`PincerPayPaymentInfo` (`{ payer, transaction, network }`). Import the typed
shape so you fail at compile time if it ever changes:

```ts
import type { PincerPayContextVariables } from "@pincerpay/merchant";
// or: from "@pincerpay/merchant/nextjs"

const app = new Hono<{ Variables: PincerPayContextVariables }>();
```

> Released in lockstep with `@pincerpay/core`, `@pincerpay/agent`, and
> `@pincerpay/mcp` 0.9.0. (Version 0.7.0 was skipped; the previous release was
> 0.8.0.)
