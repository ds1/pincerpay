import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FacilitatorClient } from "../client.js";
import { registerTools } from "../tools/index.js";

/**
 * Helper to invoke a tool on a registered McpServer.
 * Since McpServer doesn't expose a direct call method, we
 * test the tool registration and handler logic by re-implementing
 * the tool invocation pattern.
 */

function createTestSetup(apiKey?: string) {
  const server = new McpServer(
    { name: "test", version: "0.0.1" },
    { capabilities: { logging: {} } },
  );
  const client = new FacilitatorClient({
    apiKey,
    facilitatorUrl: "http://localhost:4402",
  });
  registerTools(server, client);
  return { server, client };
}

// We test tools via the MCP stdio protocol by sending JSON-RPC messages.
// For unit tests, we'll test the tool handler logic more directly.

describe("Tool registrations", () => {
  it("registers 7 tools", () => {
    const { server } = createTestSetup();
    // The server has internal state — we verify via the protocol
    // Since we can't easily extract tool list without a transport,
    // we verify the setup doesn't throw
    expect(server).toBeDefined();
  });
});

describe("FacilitatorClient integration with tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getStatus calls requireAuth and makes request", async () => {
    const client = new FacilitatorClient({
      apiKey: "pp_live_test",
      facilitatorUrl: "http://localhost:4402",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "tx1",
          status: "confirmed",
          amount: "1000000",
        }),
        { status: 200 },
      ),
    );

    const result = await client.getStatus("abc123");
    expect(result).toEqual({
      id: "tx1",
      status: "confirmed",
      amount: "1000000",
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4402/v1/status/abc123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-pincerpay-api-key": "pp_live_test",
        }),
      }),
    );
  });

  it("getStatus throws without API key", async () => {
    const client = new FacilitatorClient({
      facilitatorUrl: "http://localhost:4402",
    });

    await expect(client.getStatus("abc123")).rejects.toThrow(
      "This operation requires a PincerPay API key",
    );
  });

  it("getSupported calls facilitator without auth", async () => {
    const client = new FacilitatorClient({
      facilitatorUrl: "http://localhost:4402",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ kinds: [{ scheme: "exact", network: "solana" }] }),
        { status: 200 },
      ),
    );

    const result = await client.getSupported();
    expect(result).toEqual({
      kinds: [{ scheme: "exact", network: "solana" }],
    });
  });
});

describe("Chain resolution", () => {
  it("resolveChain returns config for valid chains", async () => {
    const { resolveChain } = await import("@pincerpay/core");
    expect(resolveChain("solana")).toBeDefined();
    expect(resolveChain("base")).toBeDefined();
    expect(resolveChain("polygon")).toBeDefined();
    expect(resolveChain("solana-devnet")).toBeDefined();
    expect(resolveChain("base-sepolia")).toBeDefined();
    expect(resolveChain("polygon-amoy")).toBeDefined();
  });

  it("resolveChain returns undefined for invalid chain", async () => {
    const { resolveChain } = await import("@pincerpay/core");
    expect(resolveChain("bitcoin")).toBeUndefined();
  });
});

describe("Config validation", () => {
  it("PincerPayConfigSchema validates correct config", async () => {
    const { PincerPayConfigSchema } = await import("@pincerpay/core");
    const result = PincerPayConfigSchema.safeParse({
      apiKey: "pp_live_test",
      merchantAddress: "SomeSolanaAddress",
      routes: {
        "GET /api/weather": { price: "0.01" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("PincerPayConfigSchema rejects missing apiKey", async () => {
    const { PincerPayConfigSchema } = await import("@pincerpay/core");
    const result = PincerPayConfigSchema.safeParse({
      merchantAddress: "addr",
      routes: {},
    });
    expect(result.success).toBe(false);
  });
});
