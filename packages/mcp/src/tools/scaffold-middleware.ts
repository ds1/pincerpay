import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = {
  framework: z
    .enum(["express", "hono"])
    .describe("Web framework to generate middleware for."),
  routes: z
    .array(
      z.object({
        pattern: z
          .string()
          .describe("Route pattern, e.g. 'GET /api/weather'."),
        price: z.string().describe("USDC price, e.g. '0.01'."),
        chain: z.string().default("solana").describe("Chain shorthand."),
        description: z.string().optional(),
      }),
    )
    .min(1)
    .describe("Paywalled routes to configure."),
  merchantAddress: z
    .string()
    .optional()
    .describe("Merchant wallet address (placeholder used if omitted)."),
  typescript: z
    .boolean()
    .default(true)
    .describe("Generate TypeScript (true) or JavaScript (false)."),
};

function generateExpressCode(
  addr: string,
  routesBlock: string,
  ts: boolean,
): string {
  const bang = ts ? "!" : "";
  return `import express from "express";
import { pincerpay } from "@pincerpay/merchant/express";

const app = express();

app.use(
  pincerpay({
    apiKey: process.env.PINCERPAY_API_KEY${bang},
    merchantAddress: "${addr}",
    routes: {
${routesBlock}
    },
  })
);

// Your route handlers below — any route matching the patterns
// above will require x402 USDC payment before the handler runs.
app.get("/api/example", (req, res) => {
  res.json({ message: "Paid content!" });
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});`;
}

function generateHonoCode(
  addr: string,
  routesBlock: string,
  ts: boolean,
): string {
  const bang = ts ? "!" : "";
  return `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { pincerpayHono } from "@pincerpay/merchant/hono";

const app = new Hono();

app.use(
  "*",
  pincerpayHono({
    apiKey: process.env.PINCERPAY_API_KEY${bang},
    merchantAddress: "${addr}",
    routes: {
${routesBlock}
    },
  })
);

// Your route handlers below — any route matching the patterns
// above will require x402 USDC payment before the handler runs.
app.get("/api/example", (c) => {
  return c.json({ message: "Paid content!" });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });`;
}

export function registerScaffoldMiddleware(server: McpServer) {
  server.tool(
    "scaffold-x402-middleware",
    "Generate Express or Hono middleware code that adds x402 USDC payment walls to API routes. " +
      "Produces a complete, copy-paste-ready code snippet with PincerPay SDK setup, " +
      "route configuration, and environment variable usage. " +
      "Supports Solana (primary), Base, and Polygon chains.",
    inputSchema,
    async ({ framework, routes, merchantAddress, typescript }) => {
      const addr = merchantAddress ?? "YOUR_WALLET_ADDRESS";
      const routesBlock = routes
        .map((r) => {
          const desc = r.description
            ? `, description: "${r.description}"`
            : "";
          return `      "${r.pattern}": { price: "${r.price}", chain: "${r.chain}"${desc} }`;
        })
        .join(",\n");

      const code =
        framework === "express"
          ? generateExpressCode(addr, routesBlock, typescript)
          : generateHonoCode(addr, routesBlock, typescript);

      const installCmd =
        framework === "express"
          ? "npm install @pincerpay/merchant express"
          : "npm install @pincerpay/merchant hono @hono/node-server";

      const lang = typescript ? "typescript" : "javascript";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `## Install\n\n\`\`\`bash\n${installCmd}\n\`\`\`\n\n` +
              `## Code\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n` +
              `## Environment Variables\n\n\`\`\`\nPINCERPAY_API_KEY=pp_live_your_key_here\n\`\`\`\n\n` +
              `Get your API key from https://pincerpay.com/dashboard/settings`,
          },
        ],
      };
    },
  );
}
