---
"@pincerpay/onboarding": patch
---

Warn (on stderr) when minting an API key without `TOKEN_PEPPER` set, which mints a legacy SHA-256 key via fallback instead of an HMAC key. Surfaces a missing pepper to operators running `bootstrap-merchant` so it isn't silently misconfigured (#133).
