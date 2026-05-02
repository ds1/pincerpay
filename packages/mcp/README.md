# @pincerpay/mcp

[![npm](https://img.shields.io/npm/v/@pincerpay/mcp?style=flat-square)](https://www.npmjs.com/package/@pincerpay/mcp)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/mcp?style=flat-square)](https://www.npmjs.com/package/@pincerpay/mcp)
[![license](https://img.shields.io/npm/l/@pincerpay/mcp?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

MCP server for [PincerPay](https://pincerpay.com) — on-chain USDC payment gateway for AI agents using the [x402 protocol](https://x402.org).

Works with any MCP-compatible client — Claude, Cursor, Windsurf, Copilot, Gemini, ChatGPT, Codex, DeepSeek, Replit, and more.

## Quick Start

### Claude Code

```bash
claude mcp add pincerpay -- npx -y @pincerpay/mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

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

```bash
npx @pincerpay/mcp --transport=http --port=3100 --api-key=pp_live_your_key
```

## Tools (26)

### Monitoring & Discovery

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `list-supported-chains` | List supported chains and USDC configs | No |
| `estimate-gas-cost` | Estimate gas fees per chain | No |
| `check-facilitator-health` | Check facilitator connectivity and worker status | No |
| `get-settlement-metrics` | Fetch performance metrics (latency, counters, error rates) | No |

### Operations

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `check-transaction-status` | Query transaction status by hash/signature | Yes |
| `verify-payment` | Dry-run payment validation without broadcasting | Yes |
| `list-transactions` | List transactions with filtering and pagination | Yes |

### Paywall CRUD

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `list-paywalls` | List paywalled endpoints | Yes |
| `create-paywall` | Create a new paywalled endpoint | Yes |
| `update-paywall` | Update paywall price, status, or chains | Yes |
| `delete-paywall` | Permanently delete a paywall | Yes |

### Agent Management

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `list-agents` | List agents that have interacted with your account | Yes |
| `update-agent` | Update agent name, status, or spending limits | Yes |

### Webhook Observability

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `list-webhooks` | List webhook delivery attempts | Yes |
| `retry-webhook` | Retry a failed webhook delivery | Yes |

### Account

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `get-merchant-profile` | Fetch merchant profile and configuration | Yes |

### Scaffolding & Validation

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `validate-payment-config` | Validate merchant config with route pattern checks | No |
| `scaffold-x402-middleware` | Generate Express/Hono/Next.js middleware | No |
| `scaffold-agent-client` | Generate agent fetch wrapper with spending policies | No |
| `generate-ucp-manifest` | Create commerce discovery manifest | No |

### Onboarding

Onboarding tools support **two auth modes**:

- **Admin mode** — `DATABASE_URL` is set on the MCP server. Tools write directly to the PincerPay database. Use for self-hosted deployments or operator workflows.
- **Public mode** — `~/.pincerpay/credentials.json` exists. Tools call the authenticated facilitator API using the bearer token from the CLI. Use after running `npx @pincerpay/cli signup` or `login`.

Tools resolve the mode at call time. If neither mode is available, `login-instructions` is the recommended next call.

| Tool | Description | Auth |
|------|-------------|:---:|
| `bootstrap-wallets` | Generate non-custodial Solana + EVM wallets from one BIP-39 mnemonic. Phantom + MetaMask compatible. | None |
| `bootstrap-merchant` | End-to-end: generate wallets, create merchant, mint API key. | Admin or Public |
| `create-api-key` | Mint a new pp_live_* API key. | Admin or Public |
| `list-merchants` | Admin: list all. Public: just the caller's own merchant. | Admin or Public |
| `whoami` | Diagnostic — current auth mode, user, merchant. | None (works in any mode) |
| `login-instructions` | Returns terminal commands to authenticate the MCP server. | None |

For public mode, the recommended workflow is: install the CLI (`npm install -g @pincerpay/cli` or use `npx`), run `npx @pincerpay/cli signup` once in any terminal, then this MCP server picks up the credentials automatically on the next tool call. No restart needed.

See [Merchant Onboarding](https://pincerpay.com/docs/onboarding) and [`@pincerpay/cli`](https://www.npmjs.com/package/@pincerpay/cli) for the full workflow.

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Chain configs | `chain://{shorthand}` | Config for any of the 6 supported chains |
| OpenAPI spec | `pincerpay://openapi` | Live facilitator OpenAPI spec |
| Documentation | `docs://pincerpay/{topic}` | Embedded docs (5 topics — see below) |

### Doc Topics

| Topic | URI | Content |
|-------|-----|---------|
| Getting Started | `docs://pincerpay/getting-started` | Prerequisites, Choose Your Path (merchant vs agent), devnet/mainnet, key concepts |
| Merchant Guide | `docs://pincerpay/merchant` | Express, Hono, and Next.js middleware setup, multi-chain routes, config reference |
| Agent Guide | `docs://pincerpay/agent` | Agent setup, spending policies (base units), runtime management, properties |
| Troubleshooting | `docs://pincerpay/troubleshooting` | Common issues table, devnet funding, debugging tips |
| Reference | `docs://pincerpay/reference` | Chain shorthands, USDC amounts, package exports, API methods |

## Prompts (6)

| Prompt | Description |
|--------|-------------|
| `get-started` | Interactive onboarding — determines your role and guides you to the right flow |
| `integrate-merchant` | Step-by-step merchant SDK integration (Express, Hono, or Next.js) |
| `integrate-agent` | Agent SDK setup with spending policies and gas estimates |
| `debug-transaction` | Transaction troubleshooting by hash/signature |
| `manage-paywalls` | Paywall management — list, create, update, delete, or review configuration |
| `monitor-payments` | Payment monitoring — overview, failure investigation, pending transaction analysis |

## CLI Options

```
--api-key=KEY           PincerPay API key (or PINCERPAY_API_KEY env var)
--facilitator-url=URL   Custom facilitator URL (or PINCERPAY_FACILITATOR_URL)
--transport=stdio|http  Transport type (default: stdio)
--port=PORT             HTTP port (default: 3100, only with --transport=http)
```

## API Key

Get your API key from [pincerpay.com/dashboard/settings](https://pincerpay.com/dashboard/settings).

Developer tools (scaffolding, gas estimates, chain listing, config validation, health checks) work without an API key. Operations tools (transactions, paywalls, agents, webhooks, merchant profile) require one.

## License

MIT
