import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { authModeErrorMessage, resolveAuthMode } from "../auth-mode.js";
import { createOnboardingClient, OnboardingApiError } from "../onboarding-client.js";

interface HealthResponse {
  ok: boolean;
  authUserId: string;
  cliSessionId: string;
  scope: string;
  merchant: {
    id: string;
    name: string;
    walletAddress: string;
    supportedChains: string[];
  } | null;
}

export function registerWhoami(server: McpServer) {
  server.tool(
    "whoami",
    "Returns information about the currently authenticated user — auth mode (admin vs public), " +
      "auth user id, session info, and current merchant. Useful diagnostic before mutating tools.",
    {},
    async () => {
      const auth = resolveAuthMode();

      if (auth.mode === "none") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  authenticated: false,
                  message: authModeErrorMessage(),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (auth.mode === "admin") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  authenticated: true,
                  mode: "admin",
                  note: "Admin mode — DATABASE_URL is set. All onboarding operations are scoped to whichever merchant you specify.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      try {
        const client = createOnboardingClient(auth.credentials);
        const health = await client.request<HealthResponse>("GET", "/v1/onboarding/health");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  authenticated: true,
                  mode: "public",
                  email: auth.credentials.email,
                  authUserId: health.authUserId,
                  scope: health.scope,
                  facilitatorUrl: auth.credentials.facilitatorUrl,
                  expiresAt: auth.credentials.expiresAt,
                  merchant: health.merchant,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        const status = err instanceof OnboardingApiError ? err.status : "?";
        return {
          content: [
            {
              type: "text" as const,
              text: `whoami failed [${status}]: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
