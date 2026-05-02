---
title: "MCP Server"
description: "Connect PincerPay to any MCP-compatible AI assistant."
order: 3.5
section: "SDKs"
---

The `@pincerpay/mcp` package is a [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI coding assistants direct access to PincerPay's chain configs, code scaffolding, gas estimates, documentation, and transaction tools. Connect it to any MCP-compatible client.

## Quick Start

### Claude Code

```bash
claude mcp add pincerpay -- npx -y @pincerpay/mcp
```

That's it. Claude Code will automatically discover and use the PincerPay tools.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pincerpay": {
      "command": "npx",
      "args": ["-y", "@pincerpay/mcp"],
      "env": {
        "PINCERPAY_API_KEY": "pp_live_your_key_here"
      }
    }
  }
}
```

### Cursor

Settings > Tools & MCP > Add Server:

```json
{
  "mcpServers": {
    "pincerpay": {
      "command": "npx",
      "args": ["-y", "@pincerpay/mcp"],
      "env": {
        "PINCERPAY_API_KEY": "pp_live_your_key_here"
      }
    }
  }
}
```

### Windsurf

Add via the Cascade MCP panel or `mcp.json`:

```json
{
  "mcpServers": {
    "pincerpay": {
      "command": "npx",
      "args": ["-y", "@pincerpay/mcp"],
      "env": {
        "PINCERPAY_API_KEY": "pp_live_your_key_here"
      }
    }
  }
}
```

### Remote (Streamable HTTP)

Run as a standalone HTTP server for remote or shared environments:

```bash
npx @pincerpay/mcp --transport=http --port=3100 --api-key=pp_live_your_key
```

## Tools (24)

The MCP server exposes 24 tools covering the full developer lifecycle: onboarding, setup, configure, deploy, monitor, and debug.

### Monitoring & Discovery

| Tool | Description | Auth |
|------|-------------|:---:|
| `list-supported-chains` | List supported chains and USDC configs | No |
| `estimate-gas-cost` | Estimate gas fees per chain | No |
| `check-facilitator-health` | Check facilitator connectivity and worker status | No |
| `get-settlement-metrics` | Fetch performance metrics (latency, counters, error rates) | No |

### Operations

| Tool | Description | Auth |
|------|-------------|:---:|
| `check-transaction-status` | Query transaction status by hash/signature | Yes |
| `verify-payment` | Dry-run payment validation without broadcasting | Yes |
| `list-transactions` | List transactions with filtering and pagination | Yes |

### Paywall CRUD

| Tool | Description | Auth |
|------|-------------|:---:|
| `list-paywalls` | List paywalled endpoints | Yes |
| `create-paywall` | Create a new paywalled endpoint | Yes |
| `update-paywall` | Update paywall price, status, or chains | Yes |
| `delete-paywall` | Permanently delete a paywall | Yes |

### Agent Management

| Tool | Description | Auth |
|------|-------------|:---:|
| `list-agents` | List agents that have interacted with your account | Yes |
| `update-agent` | Update agent name, status, or spending limits | Yes |

### Webhook Observability

| Tool | Description | Auth |
|------|-------------|:---:|
| `list-webhooks` | List webhook delivery attempts | Yes |
| `retry-webhook` | Retry a failed webhook delivery | Yes |

### Account

| Tool | Description | Auth |
|------|-------------|:---:|
| `get-merchant-profile` | Fetch merchant profile and configuration | Yes |

### Scaffolding & Validation

| Tool | Description | Auth |
|------|-------------|:---:|
| `validate-payment-config` | Validate merchant config with route pattern checks | No |
| `scaffold-x402-middleware` | Generate Express/Hono/Next.js middleware | No |
| `scaffold-agent-client` | Generate agent fetch wrapper with spending policies | No |
| `generate-ucp-manifest` | Create commerce discovery manifest | No |

### Onboarding

| Tool | Description | Auth |
|------|-------------|:---:|
| `bootstrap-wallets` | Generate non-custodial Solana + EVM wallets from one BIP-39 mnemonic | No |
| `bootstrap-merchant` | End-to-end: generate wallets, create merchant row, mint API key | DB |
| `create-api-key` | Mint a new API key for an existing merchant | DB |
| `list-merchants` | List all merchants in the database | DB |

The "DB" auth tier requires the MCP server to run with a `DATABASE_URL` environment variable set — these tools write to (or read from) the PincerPay database directly. Public deployments of `@pincerpay/mcp` (via `npx`) only expose `bootstrap-wallets`; the other three return a clear error directing users to dashboard signup. Self-hosted / admin deployments can unlock all four. See [Merchant Onboarding](/docs/onboarding) for the full workflow.

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Chain configs | `chain://{shorthand}` | Config for any of the 6 supported chains |
| OpenAPI spec | `pincerpay://openapi` | Live facilitator OpenAPI spec |
| Documentation | `docs://pincerpay/{topic}` | Embedded docs (5 topics) |

### Doc Topics

The server embeds full documentation that your assistant can read on demand:

| Topic | URI | Content |
|-------|-----|---------|
| Getting Started | `docs://pincerpay/getting-started` | Prerequisites, Choose Your Path (merchant vs agent), devnet/mainnet, key concepts |
| Merchant Guide | `docs://pincerpay/merchant` | Express, Hono, and Next.js middleware setup, multi-chain routes, config reference |
| Agent Guide | `docs://pincerpay/agent` | Agent setup, spending policies (base units), runtime management, properties |
| Troubleshooting | `docs://pincerpay/troubleshooting` | Common issues table, devnet funding, debugging tips |
| Reference | `docs://pincerpay/reference` | Chain shorthands, USDC amounts, package exports, API methods |

## Prompts (6)

Interactive prompts guide your assistant through common workflows:

| Prompt | Description |
|--------|-------------|
| `get-started` | Interactive onboarding — determines your role and guides you to the right flow |
| `integrate-merchant` | Step-by-step merchant SDK integration (Express, Hono, or Next.js) |
| `integrate-agent` | Agent SDK setup with spending policies and gas estimates |
| `debug-transaction` | Transaction troubleshooting by hash/signature |
| `manage-paywalls` | Paywall management — list, create, update, delete, or review configuration |
| `monitor-payments` | Payment monitoring — overview, failure investigation, pending transaction analysis |

## Try It

After connecting, paste any of these into your AI assistant:

- "Bootstrap a new PincerPay merchant for me — generate wallets and an API key"
- "Generate a non-custodial wallet set with a 12-word mnemonic"
- "Set up PincerPay merchant middleware for my Express app"
- "Scaffold an agent client with a $5/day spending limit on Solana"
- "What chains does PincerPay support? Show me gas costs for each"
- "Generate a UCP manifest for my API"
- "Check the status of this transaction: 5UxK3..."
- "Help me debug why my agent is getting 402 errors"
- "List all my paywalled endpoints and review the pricing"
- "Show me failed transactions from the last week"
- "Create a paywall for GET /api/premium at $0.05 USDC"
- "List my agents and their spending limits"
- "Show me failed webhook deliveries and retry them"

## API Key

Get your API key from [pincerpay.com/dashboard/settings](https://pincerpay.com/dashboard/settings).

Developer tools (scaffolding, gas estimates, chain listing, config validation, health checks) work **without** an API key. Operations tools (transactions, paywalls, agents, webhooks, merchant profile) require one.

For Claude Code, pass the key as an environment variable:

```bash
claude mcp add pincerpay -e PINCERPAY_API_KEY=pp_live_your_key -- npx -y @pincerpay/mcp
```

## CLI Options

```
--api-key=KEY           PincerPay API key (or PINCERPAY_API_KEY env var)
--facilitator-url=URL   Custom facilitator URL (or PINCERPAY_FACILITATOR_URL)
--transport=stdio|http  Transport type (default: stdio)
--port=PORT             HTTP port (default: 3100, only with --transport=http)
```
