---
"@pincerpay/merchant": minor
"@pincerpay/agent": minor
---

Server-side quotes for merchants that sell something other than an HTTP route (#178).

`@pincerpay/merchant` adds `buildPaymentRequirements`, `buildPaymentRequired`, `matchOfferedRequirement`, the typed `PincerPayError`, and structural x402 2.6 types. `buildPaymentRequirements` requires a chain, validates `payTo`, takes the Solana `feePayer` from `/v1/supported`, and grosses the amount up by an optional `feeBps` cut recorded in `extra.feeBps`. `PincerPayClient` takes a `PincerPayClientConfig` with no `routes`, strips a trailing `/v1`, URL-encodes the transaction hash, times out after 60 seconds, returns typed responses, and throws `PincerPayError` on every non-2xx response. The middleware accepts an optional `feeBps`. Its 402 body is unchanged when `feeBps` is unset.

`@pincerpay/agent` adds `PincerPayAgent.createPaymentPayload(paymentRequired)`. It signs a challenge that arrived outside HTTP, such as an MCP tool result, and runs the same spending policies as `fetch()`.
