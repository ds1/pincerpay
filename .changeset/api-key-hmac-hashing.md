---
"@pincerpay/db": minor
"@pincerpay/onboarding": patch
---

Hash API keys with HMAC-SHA256 + pepper (parity with `cli_sessions`).

`@pincerpay/db` adds shared key-hashing helpers (`hashNewApiKey`, `apiKeyHashHmac`, `apiKeyHashSha256`, `getApiKeyPepper`) and a new `api_keys.key_hash_hmac` column (migration `0004`; the legacy `key_hash` column is now nullable). New API keys are hashed with HMAC when `TOKEN_PEPPER` is configured and fall back to legacy SHA-256 otherwise; verification accepts both during the migration window. `@pincerpay/onboarding` now mints keys through the shared helper so bootstrapped merchants get HMAC-hashed keys.
