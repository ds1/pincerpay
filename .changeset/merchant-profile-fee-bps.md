---
"@pincerpay/core": patch
"@pincerpay/db": minor
---

Add the optional `feeBps` field to `MerchantProfile`. `GET /v1/merchant` now returns the merchant's fee in basis points.

`@pincerpay/db` adds the `merchants.fee_bps` column, an integer that defaults to 100. Migration `0005` adds it and defines the `merchant_fee_accruals` view, which meters each merchant's fee per month from settled x402 payments.
