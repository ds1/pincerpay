import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { x402Facilitator } from "@x402/core/facilitator";
import { setupSolanaFacilitatorWithKora } from "../chains/solana.js";
import { createLogger } from "../middleware/logging.js";

const TEST_CHAIN = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // Solana devnet
const MOCK_FEE_PAYER = "KoraFeePayer111111111111111111111111111111111";

describe("Kora facilitator setup", () => {
  let mockServer: ReturnType<typeof createMockKoraServer>;

  function createMockKoraServer() {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      const method = body.method as string;

      const responses: Record<string, unknown> = {
        getFeePayer: MOCK_FEE_PAYER,
      };

      if (method in responses) {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, result: responses[method] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `Unknown: ${method}` } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    return { fetchMock };
  }

  beforeAll(() => {
    mockServer = createMockKoraServer();
    vi.stubGlobal("fetch", mockServer.fetchMock);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("registers SVM scheme via Kora signer", async () => {
    const facilitator = new x402Facilitator();
    const logger = createLogger("silent");

    const result = await setupSolanaFacilitatorWithKora(facilitator, {
      koraRpcUrl: "http://localhost:8080",
      networks: [TEST_CHAIN],
      logger,
    });

    expect(result.feePayer).toBe(MOCK_FEE_PAYER);

    const { kinds } = facilitator.getSupported();
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.some((s) => s.network === TEST_CHAIN)).toBe(true);
  });

  it("passes API key to Kora RPC", async () => {
    const facilitator = new x402Facilitator();
    const logger = createLogger("silent");

    await setupSolanaFacilitatorWithKora(facilitator, {
      koraRpcUrl: "http://localhost:8080",
      koraApiKey: "test-key-123",
      networks: [TEST_CHAIN],
      logger,
    });

    // Verify fetch was called with Authorization header
    expect(mockServer.fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key-123",
        }),
      }),
    );
  });
});
