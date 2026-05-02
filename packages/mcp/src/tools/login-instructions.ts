import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveAuthMode } from "../auth-mode.js";

export function registerLoginInstructions(server: McpServer) {
  server.tool(
    "login-instructions",
    "Returns instructions for authenticating the MCP server. Call this when an onboarding " +
      "tool returns an auth error to guide the user through the right flow.",
    {},
    async () => {
      const auth = resolveAuthMode();
      const status = auth.mode;

      const message = [
        `Current auth status: ${status}.`,
        "",
        "To authenticate the MCP server for self-serve onboarding tools (bootstrap-merchant,",
        "create-api-key, list-merchants, whoami), you have two options:",
        "",
        "Option 1 — Public mode (most users):",
        "  Open a terminal and run:",
        "    npx @pincerpay/cli signup     # if you don't have an account yet",
        "    npx @pincerpay/cli login      # if you already have one",
        "  This walks you through email + password + OTP entirely in the terminal.",
        "  After login, this MCP server will pick up ~/.pincerpay/credentials.json",
        "  automatically on the next tool call. No restart needed.",
        "",
        "Option 2 — Admin mode (self-hosted):",
        "  Set DATABASE_URL on the MCP server's environment to a PostgreSQL",
        "  connection string with write access to the PincerPay schema.",
        "  Restart the MCP server.",
        "",
        "After authenticating, call `whoami` to verify everything is wired up.",
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: message }],
      };
    },
  );
}
