# @pincerpay/onboarding

## 0.3.3

### Patch Changes

- [#150](https://github.com/ds1/pincerpay/pull/150) [`7008fb4`](https://github.com/ds1/pincerpay/commit/7008fb47f9ef07810f7abd81e60fce5b565be8ab) Thanks [@ds1](https://github.com/ds1)! - Warn (on stderr) when minting an API key without `TOKEN_PEPPER` set, which mints a legacy SHA-256 key via fallback instead of an HMAC key. Surfaces a missing pepper to operators running `bootstrap-merchant` so it isn't silently misconfigured ([#133](https://github.com/ds1/pincerpay/issues/133)).

## 0.3.2

### Patch Changes

- Updated dependencies [[`4f1201e`](https://github.com/ds1/pincerpay/commit/4f1201eeba88b406ee881a04cf0c7d7bd9780cf0)]:
  - @pincerpay/core@0.10.0
