import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FacilitatorClient } from "../client.js";
import { registerScaffoldMiddleware, parseRoutePattern } from "../tools/scaffold-middleware.js";
import { registerValidateConfig } from "../tools/validate-config.js";

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

/** Fake McpServer that records each tool's handler so tests can call it. */
function recordTools(register: (server: McpServer) => void): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  const server = {
    tool: (name: string, ...rest: unknown[]) => {
      handlers.set(name, rest[rest.length - 1] as Handler);
    },
  } as unknown as McpServer;
  register(server);
  return handlers;
}

const SOLANA_WALLET = "9aE476sH92Vz7DMPyq5WLPkrKWivxeuTKEFKd2sZZcde";

describe("scaffold-x402-middleware", () => {
  const scaffold = recordTools(registerScaffoldMiddleware).get("scaffold-x402-middleware")!;

  async function generate(patterns: string[]) {
    const result = await scaffold({
      routes: patterns.map((pattern) => ({ pattern, price: "0.01", chain: "solana" })),
      merchantAddress: SOLANA_WALLET,
      typescript: true,
    });
    return result.content[0]!.text;
  }

  it("emits a handler for each paywalled route, matching its key (#166)", async () => {
    const text = await generate(["GET /api/weather", "POST /api/research"]);
    expect(text).toContain(`"GET /api/weather": { price: "0.01"`);
    expect(text).toContain(`app.get("/weather"`);
    expect(text).toContain(`"POST /api/research": { price: "0.01"`);
    expect(text).toContain(`app.post("/research"`);
    expect(text).not.toContain(`app.get("/example"`);
  });

  it("moves routes outside /api under it so the paywall matches", async () => {
    const text = await generate(["GET /weather"]);
    expect(text).toContain(`"GET /api/weather"`);
    expect(text).toContain(`app.get("/weather"`);
    expect(text).toContain("Moved under /api");
  });

  it("escapes interpolated strings", async () => {
    const result = await scaffold({
      routes: [{ pattern: "GET /api/x", price: "0.01", chain: "solana", description: 'say "hi"' }],
      merchantAddress: SOLANA_WALLET,
      typescript: true,
    });
    expect(result.content[0]!.text).toContain(`description: "say \\"hi\\""`);
  });

  it("parses patterns into key and handler path", () => {
    expect(parseRoutePattern("GET /api/weather")).toMatchObject({
      key: "GET /api/weather",
      handlerPath: "/weather",
      normalized: false,
    });
    expect(parseRoutePattern("post /data")).toMatchObject({
      key: "POST /api/data",
      method: "POST",
      handlerPath: "/data",
      normalized: true,
    });
    expect(parseRoutePattern("/report")).toMatchObject({ key: "GET /api/report", method: "GET" });
  });
});

describe("validate-payment-config", () => {
  const validate = recordTools(registerValidateConfig).get("validate-payment-config")!;

  async function run(config: unknown) {
    const result = await validate({ config: JSON.stringify(config) });
    return { result, body: JSON.parse(result.content[0]!.text) as { valid: boolean; errors?: string[] } };
  }

  it("reports schema errors and route errors together (#166)", async () => {
    const { result, body } = await run({
      apiKey: "pp_test_x",
      merchantAddress: SOLANA_WALLET,
      routes: { "GET /api/weather": { price: "free", chain: "notachain" } },
    });
    expect(body.valid).toBe(false);
    expect(result.isError).toBe(true);
    expect(body.errors!.some((e) => e.includes("price"))).toBe(true);
    expect(body.errors!.some((e) => e.includes('unknown chain "notachain"'))).toBe(true);
  });

  it("treats an unknown chain as an error, not a warning", async () => {
    const { body } = await run({
      apiKey: "pp_test_x",
      merchantAddress: SOLANA_WALLET,
      routes: { "GET /api/weather": { price: "0.01", chain: "notachain" } },
    });
    expect(body.valid).toBe(false);
  });

  it("treats a wallet that doesn't match the chain as an error", async () => {
    const { body } = await run({
      apiKey: "pp_test_x",
      merchantAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      routes: { "GET /api/weather": { price: "0.01", chain: "solana" } },
    });
    expect(body.valid).toBe(false);
  });

  it("accepts a valid config", async () => {
    const { result, body } = await run({
      apiKey: "pp_test_x",
      merchantAddress: SOLANA_WALLET,
      routes: { "GET /api/weather": { price: "0.01", chain: "solana" } },
    });
    expect(body.valid).toBe(true);
    expect(result.isError).toBeUndefined();
  });
});

describe("FacilitatorClient.getMetrics", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls the unauthenticated /metrics route (#166)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new FacilitatorClient({ facilitatorUrl: "http://localhost:4402" });

    await client.getMetrics();
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:4402/metrics", expect.anything());
  });
});
