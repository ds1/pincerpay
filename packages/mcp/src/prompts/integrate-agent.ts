import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAgentPrompt(server: McpServer) {
  server.prompt(
    "integrate-agent",
    "Guide for building an AI agent that automatically pays for API access with USDC. " +
      "Covers wallet setup, spending policies, and the x402 payment flow.",
    {
      chain: z
        .string()
        .default("solana")
        .describe("Primary chain."),
      maxBudget: z
        .string()
        .optional()
        .describe("Daily USDC budget, e.g. '5.00'."),
    },
    ({ chain, maxBudget }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to build an AI agent that can pay for APIs using USDC via PincerPay.

Chain: ${chain}
${maxBudget ? `Daily budget: $${maxBudget} USDC` : "No budget limit set"}

Please:
1. Use scaffold-agent-client to generate the agent code
2. Use estimate-gas-cost to explain the gas costs on ${chain}
3. Explain how the x402 payment flow works (402 challenge -> sign -> settle)
4. Show how to set up wallet key management securely
5. Explain spending policies and how to configure limits`,
          },
        },
      ],
    }),
  );
}
