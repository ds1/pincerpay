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
        .describe(
          "Daily USDC budget in human-readable format, e.g. '5.00'. " +
            "Will be converted to base units (× 1,000,000) for spending policies.",
        ),
    },
    ({ chain, maxBudget }) => {
      const budgetLine = maxBudget
        ? `Daily budget: $${maxBudget} USDC (= ${Math.round(Number(maxBudget) * 1_000_000)} base units for maxPerDay)`
        : "No budget limit set";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to build an AI agent that can pay for APIs using USDC via PincerPay.

Chain: ${chain}
${budgetLine}

Please:
1. Use scaffold-agent-client to generate the agent code${maxBudget ? ` — pass maxPerDay as "${Math.round(Number(maxBudget) * 1_000_000)}" (base units, NOT "${maxBudget}")` : ""}
2. Use estimate-gas-cost to explain the gas costs on ${chain}
3. Explain how the x402 payment flow works (402 challenge -> sign -> settle)
4. Show how to set up wallet key management securely
5. Explain spending policies — IMPORTANT: policies use base units (6 decimals), NOT human-readable amounts. $1.00 = "1000000", $0.10 = "100000". Using "0.10" will cause BigInt() to throw at runtime.`,
            },
          },
        ],
      };
    },
  );
}
