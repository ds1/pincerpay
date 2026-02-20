# @pincerpay/mcp

MCP server for [PincerPay](https://pincerpay.com) — on-chain USDC payment gateway for AI agents using the [x402 protocol](https://x402.org).

Works with Claude, Cursor, Windsurf, GitHub Copilot, Replit, and any MCP-compatible client.

## Quick Start

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
| `validate-payment-config` | Validate merchant config | No |
| `scaffold-x402-middleware` | Generate Express/Hono middleware | No |
| `scaffold-agent-client` | Generate agent fetch wrapper | No |
| `generate-ucp-manifest` | Create commerce discovery manifest | No |
| `check-transaction-status` | Query transaction status | Yes |

## Resources

| Resource | URI |
|----------|-----|
| Chain configs | `chain://{shorthand}` |
| OpenAPI spec | `pincerpay://openapi` |
| Documentation | `docs://pincerpay/{topic}` |

## Prompts

| Prompt | Description |
|--------|-------------|
| `integrate-merchant` | Step-by-step merchant SDK integration |
| `integrate-agent` | Agent SDK setup guide |
| `debug-transaction` | Transaction troubleshooting |

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
