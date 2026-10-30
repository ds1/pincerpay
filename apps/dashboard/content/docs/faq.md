---
title: FAQ
description: Frequently asked questions about PincerPay integration and usage.
order: 7
section: Reference
---

## Who pays gas fees?

Merchants never pay gas. In x402, the facilitator submits each settlement transaction and is its fee payer. On Solana, when Kora is enabled (live on devnet today), the agent reimburses that fee in USDC (typically <$0.001), so the agent never needs to hold SOL. On EVM chains, the agent signs a USDC transfer authorization and the facilitator submits it on-chain.

## What is optimistic finality?

For payments under $1 USDC, PincerPay releases the resource after the transaction is broadcast to the mempool (~200ms) rather than waiting for block confirmation. This keeps latency low for micropayments.

## Which chain should I choose?

Start with `solana-devnet` for testing. For production, `solana` offers the lowest fees and fastest finality. Use EVM chains (Base, Polygon) if your agents are EVM-native.

## Can I try PincerPay without writing code?

Yes. The [interactive demo](https://demo.pincerpay.com) simulates the full x402 payment flow in your browser. No wallet, tokens, or setup required. You can configure spending policies, trigger error scenarios, and watch each protocol step animate in real time. Use the [guided tour](https://demo.pincerpay.com/playground?tour=1) for a narrated walkthrough.

## What format are webhook payloads?

Webhooks send a POST request with a JSON body containing the transaction details: `txHash`, `status`, `amount`, `chain`, and `endpointPattern`. Configure your webhook URL in Settings.
