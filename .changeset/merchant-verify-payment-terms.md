---
"@pincerpay/merchant": patch
---

Security: settle only against the route's own payment requirements. The middleware now rejects a payment whose `accepted` terms (scheme, network, amount, asset, payTo) don't match an offered option, and sends its own copy of the terms to the facilitator instead of the agent-supplied ones.
