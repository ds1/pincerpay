# @pincerpay/mcp

[![npm](https://img.shields.io/npm/v/@pincerpay/mcp?style=flat-square)](https://www.npmjs.com/package/@pincerpay/mcp)
[![downloads](https://img.shields.io/npm/dm/@pincerpay/mcp?style=flat-square)](https://www.npmjs.com/package/@pincerpay/mcp)
[![license](https://img.shields.io/npm/l/@pincerpay/mcp?style=flat-square)](https://github.com/ds1/pincerpay/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

MCP server for [PincerPay](https://pincerpay.com) — on-chain USDC payment gateway for AI agents using the [x402 protocol](https://x402.org).

Works with Claude, Cursor, Windsurf, GitHub Copilot, Replit, and any MCP-compatible client.

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

## Tools

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `list-supported-chains` | List supported chains and USDC configs | No |
| `estimate-gas-cost` | Estimate gas fees per chain | No |
| `validate-payment-config` | Validate merchant config with route pattern checks | No |
| `scaffold-x402-middleware` | Generate Express/Hono/Next.js middleware | No |
| `scaffold-agent-client` | Generate agent fetch wrapper with spending policies | No |
| `generate-ucp-manifest` | Create commerce discovery manifest | No |
| `check-transaction-status` | Query transaction status | Yes |

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

## Prompts

| Prompt | Description |
|--------|-------------|
| `get-started` | Interactive onboarding — determines your role and guides you to the right flow |
| `integrate-merchant` | Step-by-step merchant SDK integration (Express, Hono, or Next.js) |
| `integrate-agent` | Agent SDK setup with spending policies and gas estimates |
| `debug-transaction` | Transaction troubleshooting by hash/signature |

## CLI Options

```
--api-key=KEY           PincerPay API key (or PINCERPAY_API_KEY env var)
--facilitator-url=URL   Custom facilitator URL (or PINCERPAY_FACILITATOR_URL)
--transport=stdio|http  Transport type (default: stdio)
--port=PORT             HTTP port (default: 3100, only with --transport=http)
```

## API Key

Get your API key from [pincerpay.com/dashboard/settings](https://pincerpay.com/dashboard/settings).

Developer tools (scaffolding, gas estimates, chain listing, config validation) work without an API key. Operations tools (transaction status) require one.

## License

MIT
