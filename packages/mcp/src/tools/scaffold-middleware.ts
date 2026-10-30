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

const BASE_PATH = "/api";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];

export interface ScaffoldRoute {
  /** Paywall key as the middleware sees it, e.g. "GET /api/weather". */
  key: string;
  method: Method;
  /** Handler path relative to BASE_PATH, e.g. "/weather". */
  handlerPath: string;
  /** True when the input pattern was not already under BASE_PATH. */
  normalized: boolean;
}

/**
 * Parse "METHOD /path" into a paywall key and a handler path. The generated
 * app is a catch-all at app/api/[...route], so every route lives under /api:
 * the middleware matches the full request path, while Hono handlers are
 * registered relative to basePath. A missing method defaults to GET.
 */
export function parseRoutePattern(pattern: string): ScaffoldRoute {
  const parts = pattern.trim().split(/\s+/);
  const first = parts[0]?.toUpperCase() ?? "";
  const hasMethod = parts.length > 1 && (METHODS as readonly string[]).includes(first);
  const method = (hasMethod ? first : "GET") as Method;
  let path = (hasMethod ? parts.slice(1) : parts).join(" ");
  if (!path.startsWith("/")) path = `/${path}`;

  const underBase = path === BASE_PATH || path.startsWith(`${BASE_PATH}/`);
  const fullPath = underBase ? path : `${BASE_PATH}${path === "/" ? "" : path}`;
  return {
    key: `${method} ${fullPath}`,
    method,
    handlerPath: fullPath.slice(BASE_PATH.length) || "/",
    normalized: !underBase,
  };
}

function renderAddressBlock(
  merchantAddress: string | undefined,
  merchantAddresses: Record<string, string> | undefined,
): string {
  if (merchantAddresses && Object.keys(merchantAddresses).length > 0) {
    const entries = Object.entries(merchantAddresses)
      .map(([chain, addr]) => `      ${JSON.stringify(chain)}: ${JSON.stringify(addr)}`)
      .join(",\n");
    return `    merchantAddresses: {\n${entries},\n    }`;
  }
  return `    merchantAddress: ${JSON.stringify(merchantAddress ?? "YOUR_WALLET_ADDRESS")}`;
}

function renderHandlers(routes: ScaffoldRoute[]): string {
  const seen = new Set<string>();
  return routes
    .filter((r) => {
      if (seen.has(r.key)) return false;
      seen.add(r.key);
      return true;
    })
    .map(
      (r) =>
        `app.${r.method.toLowerCase()}(${JSON.stringify(r.handlerPath)}, (c) => {\n` +
        `  return c.json({ message: ${JSON.stringify(`Paid content for ${r.key}`)} });\n` +
        `});`,
    )
    .join("\n\n");
}

export function generateNextjsCode(
  addressBlock: string,
  routesBlock: string,
  handlers: string,
  ts: boolean,
): string {
  const bang = ts ? "!" : "";
  return `// app/api/[...route]/route.ts
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createPincerPayMiddleware } from "@pincerpay/merchant/nextjs";

// basePath must match the catch-all route location
const app = new Hono().basePath("${BASE_PATH}");

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

// Route handlers: paths are relative to basePath ("${BASE_PATH}")
${handlers}

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);`;
}

export function registerScaffoldMiddleware(server: McpServer) {
  server.tool(
    "scaffold-x402-middleware",
    "Generate Next.js middleware code that adds x402 USDC payment walls to API routes. " +
      "Produces a complete, copy-paste-ready code snippet with PincerPay SDK setup, " +
      "route configuration, one handler per paywalled route, and environment variable usage. " +
      "Uses a Hono adapter in a catch-all App Router route. " +
      "Supports Solana (primary), Base, and Polygon chains. " +
      "Pass `merchantAddresses` for multi-chain merchants, `merchantAddress` for single-chain.",
    inputSchema,
    { title: "Scaffold merchant middleware", readOnlyHint: true, openWorldHint: false },
    async ({ routes, merchantAddress, merchantAddresses, typescript }) => {
      const addressBlock = renderAddressBlock(merchantAddress, merchantAddresses);
      const parsed = routes.map((r) => ({ ...r, route: parseRoutePattern(r.pattern) }));
      const routesBlock = parsed
        .map((r) => {
          const desc = r.description ? `, description: ${JSON.stringify(r.description)}` : "";
          return `      ${JSON.stringify(r.route.key)}: { price: ${JSON.stringify(r.price)}, chain: ${JSON.stringify(r.chain)}${desc} }`;
        })
        .join(",\n");
      const handlers = renderHandlers(parsed.map((r) => r.route));
      const normalized = parsed.filter((r) => r.route.normalized);

      const code = generateNextjsCode(addressBlock, routesBlock, handlers, typescript);
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
              `- The \`basePath("${BASE_PATH}")\` must match the catch-all route location\n` +
              `- Paywall keys use the full path (\`GET ${BASE_PATH}/weather\`); handlers use the path relative to basePath (\`/weather\`)\n` +
              `- Replace each generated handler body with your real response\n` +
              (normalized.length > 0
                ? `- Moved under ${BASE_PATH}: ${normalized.map((r) => `\`${r.pattern}\` → \`${r.route.key}\``).join(", ")}\n`
                : ``) +
              (isMulti
                ? `- Multi-chain: agents pay on whichever chain they hold USDC; no cross-chain conversion happens. The hosted facilitator currently settles only to the wallet registered on your PincerPay account, so payments on other chains are rejected until per-chain wallets ship (github.com/ds1/pincerpay/issues/172).\n`
                : ``) +
              `\n## Environment Variables\n\n\`\`\`\n${envVarsBlock}\n\`\`\`\n\n` +
              `Get your API key from https://pincerpay.com/dashboard/settings`,
          },
        ],
      };
    },
  );
}
