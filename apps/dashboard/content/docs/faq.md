---
title: FAQ
description: Frequently asked questions about PincerPay integration and usage.
order: 7
section: Reference
---

## Who pays gas fees?

Agents always pay gas. On Solana, agents pay a small SOL fee (typically <$0.001). PincerPay never subsidizes gas.

## What is optimistic finality?

For payments under $1 USDC, PincerPay releases the resource after the transaction is broadcast to the mempool (~200ms) rather than waiting for block confirmation. This keeps latency low for micropayments.

## Which chain should I choose?

Start with `solana-devnet` for testing. For production, `solana` offers the lowest fees and fastest finality. Use EVM chains (Base, Polygon) if your agents are EVM-native.

## What format are webhook payloads?

Webhooks send a POST request with a JSON body containing the transaction details: `txHash`, `status`, `amount`, `chain`, and `endpointPattern`. Configure your webhook URL in Settings.
