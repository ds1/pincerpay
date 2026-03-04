import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetStartedPrompt(server: McpServer) {
  server.prompt(
    "get-started",
    "Interactive onboarding for PincerPay. Determines whether you're a merchant " +
      "(accept USDC payments) or agent developer (make USDC payments) and guides " +
      "you through the appropriate integration flow.",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to integrate PincerPay into my project.

Please help me get started by determining which integration I need:

1. **Merchant** — I have an API and want to accept USDC payments from AI agents.
   → Ask me about my web framework (Express, Hono, or Next.js), which endpoints to paywall, and my wallet address.
   → Then use the integrate-merchant workflow: scaffold-x402-middleware → validate-payment-config → generate-ucp-manifest.

2. **Agent Developer** — I'm building an AI agent that needs to pay for API access with USDC.
   → Ask me about my preferred chain and spending budget.
   → Then use the integrate-agent workflow: scaffold-agent-client → estimate-gas-cost.

3. **Both** — I need both merchant and agent integration.
   → Walk me through merchant first, then agent.

4. **Troubleshooting** — I already have PincerPay integrated and need help debugging.
   → Ask for my transaction hash and use debug-transaction.

Please ask me which of these describes my situation, then guide me through the appropriate flow step by step.

Key things to keep in mind throughout:
- My project needs "type": "module" in package.json (PincerPay SDKs are ESM-only)
- .env files must be in .gitignore — never commit API keys or private keys
- For development, use devnet chains (solana-devnet, base-sepolia)
- Route prices use human-readable USDC (e.g., "0.01"), but agent spending policies use base units (e.g., "10000")`,
          },
        },
      ],
    }),
  );
}
