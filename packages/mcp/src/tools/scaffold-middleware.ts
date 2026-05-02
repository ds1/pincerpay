import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = {
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
    .describe(
      "Single-chain merchant wallet address. Use this OR merchantAddresses, not both. Placeholder used if neither is set.",
    ),
  merchantAddresses: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Per-chain merchant wallets keyed by chain shorthand, e.g. { solana: '...', polygon: '0x...' }. Use this for multi-chain merchants.",
    ),
  typescript: z
    .boolean()
    .default(true)
    .describe("Generate TypeScript (true) or JavaScript (false)."),
};

function renderAddressBlock(
  merchantAddress: string | undefined,
  merchantAddresses: Record<string, string> | undefined,
  bang: string,
): string {
  if (merchantAddresses && Object.keys(merchantAddresses).length > 0) {
    const entries = Object.entries(merchantAddresses)
      .map(([chain, addr]) => `      ${JSON.stringify(chain)}: "${addr}"`)
      .join(",\n");
    return `    merchantAddresses: {\n${entries},\n    }`;
  }
  const addr = merchantAddress ?? "YOUR_WALLET_ADDRESS";
  return `    merchantAddress: "${addr}"`;
}

function generateNextjsCode(
  addressBlock: string,
  routesBlock: string,
  ts: boolean,
): string {
  const bang = ts ? "!" : "";
  return `// app/api/[...route]/route.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

// basePath must match the catch-all route location
const app = new Hono().basePath("/api");

app.use(
  "*",
  createPincerPayMiddleware({
    apiKey: process.env.PINCERPAY_API_KEY${bang},
${addressBlock},
    routes: {
${routesBlock}
    },
  })
);

// Route handlers — paths are relative to basePath ("/api")
app.get("/example", (c) => {
  return c.json({ message: "Paid content!" });
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);`;
}

export function registerScaffoldMiddleware(server: McpServer) {
  server.tool(
    "scaffold-x402-middleware",
    "Generate Next.js middleware code that adds x402 USDC payment walls to API routes. " +
      "Produces a complete, copy-paste-ready code snippet with PincerPay SDK setup, " +
      "route configuration, and environment variable usage. " +
      "Uses a Hono adapter in a catch-all App Router route. " +
      "Supports Solana (primary), Base, and Polygon chains. " +
      "Pass `merchantAddresses` for multi-chain merchants, `merchantAddress` for single-chain.",
    inputSchema,
    async ({ routes, merchantAddress, merchantAddresses, typescript }) => {
      const bang = typescript ? "!" : "";
      const addressBlock = renderAddressBlock(
        merchantAddress,
        merchantAddresses,
        bang,
      );
      const routesBlock = routes
        .map((r) => {
          const desc = r.description
            ? `, description: "${r.description}"`
            : "";
          return `      "${r.pattern}": { price: "${r.price}", chain: "${r.chain}"${desc} }`;
        })
        .join(",\n");

      const code = generateNextjsCode(addressBlock, routesBlock, typescript);
      const installCmd = "npm install @pincerpay/merchant hono";
      const lang = typescript ? "typescript" : "javascript";

      const isMulti =
        merchantAddresses && Object.keys(merchantAddresses).length > 0;
      const envVarsBlock = isMulti
        ? `PINCERPAY_API_KEY=pp_live_your_key_here\n` +
          Object.keys(merchantAddresses ?? {})
            .map((chain) => `MERCHANT_ADDRESS_${chain.toUpperCase()}=...`)
            .join("\n")
        : `PINCERPAY_API_KEY=pp_live_your_key_here`;

      return {
        content: [
          {
            type: "text" as const,
            text:
              `## Install\n\n\`\`\`bash\n${installCmd}\n\`\`\`\n\n` +
              `## Code\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n` +
              `## Next.js Notes\n\n` +
              `- Place this file at \`app/api/[...route]/route.ts\`\n` +
              `- The \`basePath("/api")\` must match the catch-all route location\n` +
              `- Route handlers use paths relative to basePath (e.g., \`/weather\` serves \`/api/weather\`)\n` +
              `- Export each HTTP method you need (GET, POST, PUT, DELETE)\n` +
              (isMulti
                ? `- Multi-chain: agents pay on whichever chain they hold USDC; settlement routes to your registered wallet on that chain. No cross-chain conversion happens.\n`
                : ``) +
              `\n## Environment Variables\n\n\`\`\`\n${envVarsBlock}\n\`\`\`\n\n` +
              `Get your API key from https://pincerpay.com/dashboard/settings`,
          },
        ],
      };
    },
  );
}
