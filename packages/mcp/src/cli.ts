#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPincerPayMcpServer } from "./server.js";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

const apiKey = getArg("api-key") ?? process.env.PINCERPAY_API_KEY;
const facilitatorUrl =
  getArg("facilitator-url") ?? process.env.PINCERPAY_FACILITATOR_URL;
const transport = getArg("transport") ?? "stdio";

const server = createPincerPayMcpServer({
  apiKey,
  facilitatorUrl,
});

if (transport === "stdio") {
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
} else if (transport === "http") {
  const { startHttpTransport } = await import("./transport/http.js");
  const port = parseInt(getArg("port") ?? process.env.PORT ?? "3100", 10);
  await startHttpTransport(server, { port });
} else {
  console.error(`Unknown transport: "${transport}". Use "stdio" or "http".`);
  process.exit(1);
}
