import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      name: "PincerPay",
      description:
        "On-chain payment gateway for the agentic economy. Accept USDC payments from AI agents via the x402 protocol.",
      version: "1.0",
      homepage: "https://pincerpay.com",
      docs: "https://pincerpay.com/docs",
      payment: {
        handler: "pincerpay",
        protocol: "x402",
        chains: ["solana", "base", "polygon"],
        token: "USDC",
        facilitator: "https://facilitator.pincerpay.com",
      },
      sdks: {
        merchant: {
          package: "@pincerpay/merchant",
          registry: "https://www.npmjs.com/package/@pincerpay/merchant",
          description:
            "Express and Hono middleware for accepting USDC payments from AI agents",
        },
        agent: {
          package: "@pincerpay/agent",
          registry: "https://www.npmjs.com/package/@pincerpay/agent",
          description:
            "Drop-in fetch wrapper that handles x402 payment flows automatically",
        },
      },
      api: {
        facilitator: "https://facilitator.pincerpay.com",
        endpoints: [
          {
            path: "/verify",
            method: "POST",
            description: "Verify a signed payment without broadcasting",
          },
          {
            path: "/settle",
            method: "POST",
            description:
              "Verify and broadcast a signed payment, return receipt",
          },
          {
            path: "/supported",
            method: "GET",
            description: "List supported chains, tokens, and payment schemes",
          },
        ],
      },
      links: {
        github: "https://github.com/pincerpay/pincerpay",
        dashboard: "https://pincerpay.com/dashboard",
        blog: "https://pincerpay.com/blog",
        llms_txt: "https://pincerpay.com/llms.txt",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
