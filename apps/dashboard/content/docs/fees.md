---
title: Fees
description: "PincerPay's per-merchant fee rides on top of the listed price, is metered from settled payments, and is invoiced monthly in USDC."
order: 6.5
section: Reference
---

PincerPay takes a cut of each payment that settles through the facilitator. The cut rides on top of the listed price. The agent pays the listed price plus the cut. The whole payment lands in the merchant's wallet. PincerPay invoices the cut afterward.

## The Default Rate

The default cut is 100 basis points. One basis point is one hundredth of a percent. 100 basis points equals 1%.

## Rates Are Set Per Merchant

Each merchant has its own rate. `GET /v1/merchant` returns it as `feeBps`. PincerPay announces any rate change to the merchant in a dated price note.

```bash
curl https://facilitator.pincerpay.com/v1/merchant \
  -H "x-pincerpay-api-key: pp_test_..."
```

```json
{
  "id": "uuid",
  "name": "My App",
  "feeBps": 100
}
```

## Pricing a Payment With the Fee

Read `feeBps` from `GET /v1/merchant` when you quote. Add the cut to the listed price in base units with `ceil(price * (10000 + feeBps) / 10000)`. The agent signs that amount.

At 100 basis points, a listed price of 20.00 USDC becomes 20.20 USDC. In base units, `20000000` becomes `20200000`.

## How the Fee Is Metered

The facilitator records every settled payment. A database view sums the cut per merchant, per environment, and per calendar month in UTC. The cut inside one payment is `amount * feeBps / (10000 + feeBps)`. A payment of `20200000` at 100 basis points carries a cut of `200000`.

Only settled x402 payments count. Failed payments carry no fee. Test-mode payments are metered apart from live payments and never invoiced. Payments through `/v1/settle-direct` are excluded. The on-chain program takes their fee at settlement.

The facilitator deducts nothing at settle time. Metering only records what is owed.

## Monthly Invoicing in USDC

Accrued fees are invoiced monthly in USDC. Invoicing is a manual step today. PincerPay reads each closed month's live accruals and sends each merchant an invoice. The merchant pays the invoice in USDC to the wallet the invoice names. Each monthly total is rounded down to the nearest USDC base unit.

See the [API Reference](/docs/api-reference) for the full `GET /v1/merchant` response.
