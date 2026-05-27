import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FacilitatorClient } from "../client.js";

const inputSchema = {
  paymentPayload: z
    .string()
    .describe(
      "JSON-encoded payment payload from the x402 client. " +
        "Contains the signed transaction or typed data.",
    ),
  paymentRequirements: z
    .string()
    .describe(
      "JSON-encoded payment requirements from the 402 response. " +
        "Must include scheme, network, amount, and payTo.",
    ),
};

export function registerVerifyPayment(
  server: McpServer,
  client: FacilitatorClient,
) {
  server.tool(
    "verify-payment",
    "Dry-run payment validation against the PincerPay facilitator without broadcasting. " +
      "Checks signature validity, balance, and payment requirements. " +
      "Requires a PincerPay API key. Useful for debugging payment failures.",
    inputSchema,
    { title: "Verify payment (dry-run)", readOnlyHint: true, openWorldHint: true },
    async ({ paymentPayload, paymentRequirements }) => {
      try {
        client.requireAuth();
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        };
      }

      try {
        const payload = JSON.parse(paymentPayload);
        const requirements = JSON.parse(paymentRequirements);
        const result = await client.verifyPayment(payload, requirements);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Payment verification failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
