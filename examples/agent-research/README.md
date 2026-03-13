# AI Research Agent with PincerPay

This example demonstrates how AI agents can automatically pay for research and data services using USDC via the [PincerPay](https://pincerpay.com) x402 payment protocol.

## Use Case

This example showcases an **AI Research Agent** that:
- Automatically pays for premium research data
- Handles HTTP 402 payment challenges transparently
- Uses spending policies to limit costs
- Supports multiple chains (Solana, Base)

## Architecture

```
┌─────────────────┐      x402 (402 Required)       ┌──────────────────┐
│  AI Research   │ ─────────────────────────────→│  Merchant API    │
│    Agent        │  ←────────────────────────────│  (Research Data) │
│                 │   + USDC Payment Proof        │                  │
└─────────────────┘                                └──────────────────┘
        │
        │ Automatic payment handling
        ↓
┌─────────────────────────────────────────────────────────────┐
│                      PincerPay                              │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Agent SDK  │───→│ Facilitator  │───→│  Blockchain   │  │
│  │  (Pays)     │    │ (Verifies)   │    │ (Settles)     │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- A Solana devnet wallet (private key)
- (Optional) An EVM wallet for Base Sepolia testing

### Setup

1. **Install dependencies:**

```bash
cd examples/agent-research
pnpm install
```

2. **Configure environment:**

```bash
# Create .env file
cp .env.example .env

# Edit .env with your keys:
# - AGENT_SOLANA_KEY: Your Solana private key (base58)
# - AGENT_EVM_KEY: Your EVM private key (optional, for Base)
# - PINCERPAY_API_KEY: Get from https://pincerpay.com
# - MERCHANT_ADDRESS: Your Solana wallet address
```

3. **Start the merchant server:**

```bash
pnpm start
```

The merchant API will run on `http://localhost:3001`.

4. **Run the research agent:**

```bash
pnpm start:agent
```

## How It Works

### 1. Agent Configuration

```typescript
const agent = await PincerPayAgent.create({
  chains: ["solana-devnet", "base-sepolia"],
  solanaPrivateKey: process.env.AGENT_SOLANA_KEY!,
  policies: [
    {
      maxPerTransaction: "1000000",  // $1.00 max per request
      maxPerDay: "10000000",         // $10.00 max per day
    },
  ],
});
```

### 2. Automatic Payment Handling

The agent's `fetch()` method automatically handles 402 responses:

```typescript
// This "just works" - no payment logic needed in your code
const response = await agent.fetch("https://api.example.com/research");

if (response.ok) {
  const data = await response.json();
  // Process research data...
}
```

When the API returns HTTP 402:
1. Agent reads the x402 payment requirements
2. Signs a USDC transfer
3. Retries with payment proof
4. Gets the data on success

### 3. Spending Policies

Spending policies prevent runaway costs:

```typescript
// Pre-check if a payment would be allowed
const check = agent.checkPolicy("500000"); // $0.50
if (!check.allowed) {
  console.log("Payment blocked:", check.reason);
}

// Monitor daily spending
const daily = agent.getDailySpend();
console.log(`Spent $${Number(daily.amount) / 1_000_000} today`);
```

## API Endpoints

| Endpoint | Price | Chain | Description |
|----------|-------|-------|-------------|
| `GET /api/research/topics` | Free | - | Available research topics |
| `GET /api/research/summaries` | $0.05 | Solana | AI-generated summaries |
| `GET /api/research/trends` | $0.10 | Solana | Market trends |
| `GET /api/research/competitors` | $0.25 | Solana + Base | Competitor analysis |
| `POST /api/research/analyze` | $0.50 | Solana | Deep content analysis |

## Integration with AI Frameworks

### LangChain / LangGraph

```typescript
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { PincerPayAgent } from "@pincerpay/agent";

// Create the payment-enabled tool
const researchTool = {
  name: "research_data",
  description: "Get research data and analysis",
  func: async (query: string) => {
    const agent = await PincerPayAgent.create({
      chains: ["solana-devnet"],
      solanaPrivateKey: process.env.AGENT_KEY!,
    });
    
    const response = await agent.fetch(
      `https://api.example.com/research?q=${encodeURIComponent(query)}`
    );
    return response.json();
  },
};

// Use with LangChain agent...
```

### CrewAI

```typescript
import { CrewAI } from "crewai";
import { PincerPayAgent } from "@pincerpay/agent";

// Payment-enabled research agent
const researcher = {
  role: "Research Analyst",
  goal: "Find accurate market data",
  tools: [
    {
      name: "market_research",
      function: async (topic) => {
        const agent = await PincerPayAgent.create({
          chains: ["solana-devnet"],
          solanaPrivateKey: process.env.AGENT_KEY!,
        });
        
        const response = await agent.fetch(
          `https://api.example.com/research/${topic}`
        );
        return response.json();
      },
    },
  ],
};
```

### AutoGPT

```typescript
import { AutoGPT } from "autogpt";
import { PincerPayAgent } from "@pincerpay/agent";

const agent = await AutoGPT.create({
  // ... other config
  paymentAgent: await PincerPayAgent.create({
    chains: ["solana-devnet"],
    solanaPrivateKey: process.env.AGENT_KEY!,
  }),
});
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_SOLANA_KEY` | Yes | Base58-encoded Solana private key |
| `AGENT_EVM_KEY` | No | Hex-encoded EVM private key (for Base/Polygon) |
| `PINCERPAY_API_KEY` | Yes | API key from PincerPay dashboard |
| `MERCHANT_ADDRESS` | Yes | Solana wallet address for payments |
| `MERCHANT_URL` | No | Merchant API URL (default: http://localhost:3001) |

## Testing on Devnet

This example uses Solana devnet and Base Sepolia testnet:

1. Get devnet SOL from faucet: `solana airdrop 2`
2. Get devnet USDC (if needed for testing)
3. Get Sepolia ETH for Base testnet (faucet)

## Production Considerations

1. **Key Management**: Use secure key management (AWS Secrets, HashiCorp Vault)
2. **Spending Alerts**: Implement webhooks for spending notifications
3. **Rate Limiting**: Add rate limits to prevent abuse
4. **Error Handling**: Handle payment failures gracefully
5. **Monitoring**: Track payment success/failure rates

## Learn More

- [PincerPay Documentation](https://pincerpay.com/docs)
- [x402 Protocol](https://x402.org)
- [Solana Development](https://solana.com/developers)
- [Base Network](https://base.org)

## License

MIT
