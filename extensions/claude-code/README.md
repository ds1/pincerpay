# PincerPay Plugin for Claude Code

On-chain USDC payment gateway for AI agents. Accept and make stablecoin payments via the [x402 protocol](https://x402.org).

## What's Included

- **20 MCP tools** for paywall management, transaction monitoring, agent control, code scaffolding, and more
- **1 skill** (`pincerpay-best-practices`) — always-on integration context that auto-triggers when working with PincerPay
- **3 commands** — interactive workflows for onboarding, paywall management, and payment monitoring

## Installation

### From the Marketplace

```
/plugin install pincerpay
```

### Manual (MCP only)

```bash
claude mcp add pincerpay -- npx -y @pincerpay/mcp
```

## API Key Setup

Set the `PINCERPAY_API_KEY` environment variable:

```bash
export PINCERPAY_API_KEY=pp_live_your_key_here
```

Get your API key from [pincerpay.com/dashboard/settings](https://pincerpay.com/dashboard/settings).

Discovery tools (scaffolding, gas estimates, chain listing, health checks) work without an API key. Operations tools (transactions, paywalls, agents, webhooks) require one.

## Commands

| Command | Description |
|---------|-------------|
| `/pincerpay:get-started` | Interactive onboarding — determines your role and guides you to the right integration |
| `/pincerpay:manage-paywalls` | Paywall CRUD — list, create, update, delete, or review configuration |
| `/pincerpay:monitor-payments` | Payment monitoring — overview, failure investigation, pending analysis |

## Tools (20)

### Monitoring & Discovery (no API key needed)

| Tool | Description |
|------|-------------|
| `list-supported-chains` | List supported chains and USDC configs |
| `estimate-gas-cost` | Estimate gas fees per chain |
| `check-facilitator-health` | Check facilitator connectivity and worker status |
| `get-settlement-metrics` | Fetch performance metrics (latency, counters, error rates) |

### Scaffolding & Validation (no API key needed)

| Tool | Description |
|------|-------------|
| `scaffold-x402-middleware` | Generate Hono-based middleware for a Next.js App Router catch-all route |
| `scaffold-agent-client` | Generate agent fetch wrapper with spending policies |
| `validate-payment-config` | Validate merchant config with route pattern checks |
| `generate-ucp-manifest` | Create commerce discovery manifest |

### Paywall CRUD (API key required)

| Tool | Description |
|------|-------------|
| `list-paywalls` | List paywalled endpoints |
| `create-paywall` | Create a new paywalled endpoint |
| `update-paywall` | Update paywall price, status, or chains |
| `delete-paywall` | Permanently delete a paywall |

### Operations (API key required)

| Tool | Description |
|------|-------------|
| `list-transactions` | List transactions with filtering and pagination |
| `check-transaction-status` | Query transaction status by hash/signature |
| `verify-payment` | Dry-run payment validation without broadcasting |

### Agent Management (API key required)

| Tool | Description |
|------|-------------|
| `list-agents` | List agents that have interacted with your account |
| `update-agent` | Update agent name, status, or spending limits |

### Webhook Observability (API key required)

| Tool | Description |
|------|-------------|
| `list-webhooks` | List webhook delivery attempts |
| `retry-webhook` | Retry a failed webhook delivery |

### Account (API key required)

| Tool | Description |
|------|-------------|
| `get-merchant-profile` | Fetch merchant profile and configuration |

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Chain configs | `chain://{shorthand}` | Config for any of the 6 supported chains |
| OpenAPI spec | `pincerpay://openapi` | Live facilitator OpenAPI spec |
| Documentation | `docs://pincerpay/{topic}` | Embedded docs (getting-started, merchant, agent, troubleshooting, reference) |

## Links

- [pincerpay.com](https://pincerpay.com) — Dashboard, docs, API keys
- [github.com/ds1/pincerpay](https://github.com/ds1/pincerpay) — Source code
- [@pincerpay/mcp on npm](https://www.npmjs.com/package/@pincerpay/mcp) — MCP server package

## License

MIT
