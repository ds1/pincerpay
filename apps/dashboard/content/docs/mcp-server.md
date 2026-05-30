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

## Tools (26)

The MCP server exposes 26 tools covering the full developer lifecycle: onboarding, setup, configure, deploy, monitor, and debug.

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

Onboarding tools support **two auth modes**, resolved at each tool call:

- **Public mode**, when `~/.pincerpay/credentials.json` is present (created by `npx @pincerpay/cli signup` or `login`). Tools call the authenticated facilitator API.
- **Admin mode**, when `DATABASE_URL` is set on the MCP server. Tools write directly to the database. Use for self-hosted deployments or operator workflows.

If neither is available, the tools return guidance pointing at `login-instructions`.

| Tool | Description | Auth |
|------|-------------|:---:|
| `bootstrap-wallets` | Generate non-custodial Solana + EVM wallets from one BIP-39 mnemonic | None |
| `bootstrap-merchant` | End-to-end: generate wallets, create merchant, mint API key | Public or Admin |
| `create-api-key` | Mint a new pp_live_* API key | Public or Admin |
| `list-merchants` | Public: own merchant only. Admin: all merchants. | Public or Admin |
| `whoami` | Diagnostic: current auth mode, user, merchant | None |
| `login-instructions` | Returns terminal commands to authenticate | None |

**Public mode workflow** (recommended): a user runs `npx @pincerpay/cli signup` (or `login`) once in any terminal. The MCP server picks up the credentials automatically on the next tool call, with no restart needed. See [Merchant Onboarding](/docs/onboarding) and the [@pincerpay/cli docs](/docs/cli) for the full workflow.

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
| `get-started` | Interactive onboarding that determines your role and guides you to the right flow |
| `integrate-merchant` | Step-by-step merchant SDK integration (Express, Hono, or Next.js) |
| `integrate-agent` | Agent SDK setup with spending policies and gas estimates |
| `debug-transaction` | Transaction troubleshooting by hash/signature |
| `manage-paywalls` | Paywall management: list, create, update, delete, or review configuration |
| `monitor-payments` | Payment monitoring: overview, failure investigation, pending transaction analysis |

## Conventions (for building your own MCP server)

If you're modeling another MCP server on `@pincerpay/mcp`, these are the
conventions it follows so downstream servers can inherit the same safety bar:

- **Server factory.** Build the server with the exported factory rather than
  re-wiring it: `import { createPincerPayMcpServer } from "@pincerpay/mcp/server"`.
  It registers all tools, resources, and prompts and accepts `{ apiKey?, facilitatorUrl? }`.
- **Tool naming.** Lowercase kebab-case, `verb-noun` (`create-paywall`,
  `check-transaction-status`, `estimate-gas-cost`). Read tools start with
  `list-`/`get-`/`check-`; generators start with `scaffold-`/`generate-`.
- **Safety annotations.** Every tool carries MCP
  [`ToolAnnotations`](https://modelcontextprotocol.io). Read-only tools set
  `readOnlyHint: true`; tools that hit the facilitator set `openWorldHint: true`;
  mutating tools set `readOnlyHint: false` with an explicit `idempotentHint`, and
  the one irreversible tool (`delete-paywall`) sets `destructiveHint: true`.
- **Confirm on destructive actions.** `delete-paywall` takes `confirm: boolean`
  and refuses to run unless `confirm: true`, pointing the caller at the
  non-destructive alternative (`update-paywall` with `isActive=false`). Apply the
  same `confirm` gate to any tool that spends funds or destroys data.
- **Dry-run first.** `verify-payment` validates a payment against the facilitator
  **without broadcasting** - the dry-run/"paper" path before anything settles on
  chain.
- **Cost estimate.** `estimate-gas-cost` returns per-chain fee estimates so an
  agent can price an action before committing.
- **Auth is per-call and degrades gracefully.** Tools call `client.requireAuth()`
  and return a helpful, non-throwing error when no key is configured, so the
  no-auth tools (scaffolding, chain listing, health) still work.
- **Base units gotcha.** Route `price` is human-readable USDC (`"0.01"`), but
  spending policies use base units with 6 decimals (`"10000"` = $0.01). Surface
  this in tool descriptions to prevent `BigInt()` throwing at runtime.
- **`bin` convention.** The package ships a `pincerpay-mcp` bin (`dist/cli.js`)
  and an `mcpName` field, so it runs via `npx @pincerpay/mcp` over stdio or
  `--transport=http`.

**Not yet provided (don't assume these exist):** there is no exported
spend-limit guard helper and no per-agent/per-session spend-cap enforcement baked
into the server - spend limits live in agent-side `SpendingPolicy` (base units)
and the dashboard, not as an MCP middleware. If you need a reusable guard, build
it in your own server for now; a shared helper is a candidate for a future
release. The PincerPay MCP server itself does not expose a money-spending tool,
so the `confirm: true` convention currently applies to `delete-paywall`.

## Try It

After connecting, paste any of these into your AI assistant:

- "Bootstrap a new PincerPay merchant for me, generating wallets and an API key"
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
