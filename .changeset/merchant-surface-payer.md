---
"@pincerpay/merchant": patch
"@pincerpay/core": patch
---

Surface verified payer on the merchant middleware request context after settlement.

`createPincerPayMiddleware` now sets `c.set("pincerpay", { payer, transaction, network })` after a successful settle, so route handlers can attribute the action to the paying agent without re-decoding the `X-PAYMENT` header. The verified `payer` is also added to the base64-encoded `payment-response` response header.

Two new exported types: `PincerPayPaymentInfo` and `PincerPayContextVariables` (from `@pincerpay/merchant/nextjs` and `@pincerpay/core`). Use `PincerPayContextVariables` to type your Hono app: `new Hono<{ Variables: PincerPayContextVariables }>()`.

Fully backward-compatible — handlers that don't read `c.get("pincerpay")` see no behavior change. The added field on the response header JSON is additive.

Also fixes a documentation bug in the README: the `pincerpay` (Express) and `pincerpayHono` (Hono) imports never existed in source. The Hono and Next.js examples now correctly use `createPincerPayMiddleware` from `@pincerpay/merchant/nextjs`. Express adapter is on the roadmap but not yet shipped — the README now reflects that honestly.
