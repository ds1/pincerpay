import { createServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

interface HttpOptions {
  port: number;
}

export async function startHttpTransport(
  server: McpServer,
  options: HttpOptions,
) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "pincerpay-mcp" }));
      return;
    }

    if (req.url === "/mcp") {
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  });

  httpServer.listen(options.port, () => {
    console.error(
      `PincerPay MCP server (HTTP) listening on port ${options.port}`,
    );
    console.error(
      `MCP endpoint: http://localhost:${options.port}/mcp`,
    );
  });
}
