import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = {
  chain: z
    .enum([
      "solana",
      "base",
      "polygon",
      "solana-devnet",
      "base-sepolia",
      "polygon-amoy",
    ])
    .default("solana")
    .describe("Primary chain the agent will use."),
  maxPerTransaction: z
    .string()
    .optional()
    .describe(
      "Max USDC per transaction in human-readable format (e.g., '0.10').",
    ),
  maxPerDay: z
    .string()
    .optional()
    .describe("Max USDC per day in human-readable format (e.g., '5.00')."),
  typescript: z
    .boolean()
    .default(true)
    .describe("Generate TypeScript (true) or JavaScript (false)."),
};

export function registerScaffoldAgent(server: McpServer) {
  server.tool(
    "scaffold-agent-client",
    "Generate agent-side code that automatically handles x402 USDC payments. " +
      "Produces a PincerPayAgent setup with wallet configuration and " +
      "spending policies. The agent's fetch() is a drop-in replacement " +
      "for standard fetch that handles 402 challenges automatically.",
    inputSchema,
    async ({ chain, maxPerTransaction, maxPerDay, typescript }) => {
      const isSolana = chain.startsWith("solana");
      const keyVar = isSolana ? "AGENT_SOLANA_KEY" : "AGENT_EVM_KEY";
      const keyProp = isSolana ? "solanaPrivateKey" : "evmPrivateKey";
      const bang = typescript ? "!" : "";

      let policiesBlock = "";
      if (maxPerTransaction || maxPerDay) {
        const entries: string[] = [];
        if (maxPerTransaction)
          entries.push(`      maxPerTransaction: "${maxPerTransaction}"`);
        if (maxPerDay) entries.push(`      maxPerDay: "${maxPerDay}"`);
        policiesBlock = `\n  policies: [\n    {\n${entries.join(",\n")},\n    },\n  ],`;
      }

      const code = `import { PincerPayAgent } from "@pincerpay/agent";

const agent = await PincerPayAgent.create({
  chains: ["${chain}"],
  ${keyProp}: process.env.${keyVar}${bang},${policiesBlock}
});

// Use agent.fetch() as a drop-in replacement for fetch.
// It automatically handles HTTP 402 challenges by signing USDC payments.
const response = await agent.fetch("https://your-api.example.com/endpoint");
const data = await response.json();
console.log(data);`;

      const envValue = isSolana
        ? "your_base58_solana_private_key"
        : "0xYourEvmPrivateKey";

      const lang = typescript ? "typescript" : "javascript";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `## Install\n\n\`\`\`bash\nnpm install @pincerpay/agent\n\`\`\`\n\n` +
              `## Code\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n` +
              `## Environment Variables\n\n\`\`\`\n${keyVar}=${envValue}\n\`\`\`\n\n` +
              `## How It Works\n\n` +
              `1. Agent calls a paywalled API endpoint\n` +
              `2. Server responds with HTTP 402 + x402 payment challenge\n` +
              `3. Agent SDK automatically signs a USDC transfer\n` +
              `4. PincerPay facilitator verifies + broadcasts the transaction\n` +
              `5. Server delivers the protected resource\n\n` +
              `Spending policies prevent runaway spending — the agent will reject\n` +
              `payments that exceed the configured limits.`,
          },
        ],
      };
    },
  );
}
