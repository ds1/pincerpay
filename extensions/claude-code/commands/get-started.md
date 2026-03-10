---
description: Interactive onboarding for PincerPay — determines your role and guides you to the right integration flow
argument-hint: [merchant | agent | both | troubleshooting]
---

# Get Started with PincerPay

Help the user get started with PincerPay by determining which integration they need.

If an argument is provided, skip the role selection and go directly to that flow. Otherwise, ask the user which describes their situation:

1. **Merchant** — They have a Next.js API and want to accept USDC payments from AI agents.
   - Ask which endpoints to paywall and their wallet address.
   - Use the integration workflow: `scaffold-x402-middleware` -> `validate-payment-config` -> `generate-ucp-manifest`.

2. **Agent Developer** — They're building an AI agent that needs to pay for API access with USDC.
   - Ask about their preferred chain and spending budget.
   - Use the integration workflow: `scaffold-agent-client` -> `estimate-gas-cost`.

3. **Both** — They need both merchant and agent integration.
   - Walk through merchant first, then agent.

4. **Troubleshooting** — They already have PincerPay integrated and need help debugging.
   - Ask for the transaction hash and use `debug-transaction`.

Key things to keep in mind throughout:
- The project needs `"type": "module"` in package.json (PincerPay SDKs are ESM-only)
- `.env` files must be in `.gitignore` — never commit API keys or private keys
- For development, use devnet chains (`solana-devnet`, `base-sepolia`)
- Route prices use human-readable USDC (e.g., `"0.01"`), but agent spending policies use base units (e.g., `"10000"`)
