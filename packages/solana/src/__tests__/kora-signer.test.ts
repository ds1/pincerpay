import { describe, it, expect, vi, beforeEach } from "vitest";
import { createKoraFacilitatorSvmSigner } from "../kora/signer.js";
import type { KoraConfig } from "../kora/config.js";

const MOCK_FEE_PAYER = "KoraFeePayer111111111111111111111111111111111";
const MOCK_CONFIG: KoraConfig = {
  rpcUrl: "http://localhost:8080",
};

// Mock fetch for Kora RPC calls
function mockKoraFetch(responses: Record<string, unknown>) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}");
    const method = body.method as string;

    if (method in responses) {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: body.id, result: responses[method] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `Unknown method: ${method}` } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

describe("KoraFacilitatorSvmSigner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if getAddresses called before init()", () => {
    const signer = createKoraFacilitatorSvmSigner({ config: MOCK_CONFIG });
    expect(() => signer.getAddresses()).toThrow("not initialized");
  });

  it("fetches fee payer address on init()", async () => {
    const fetchMock = mockKoraFetch({ getPayerSigner: { signer_address: MOCK_FEE_PAYER, payment_address: MOCK_FEE_PAYER } });
    vi.stubGlobal("fetch", fetchMock);

    const signer = createKoraFacilitatorSvmSigner({ config: MOCK_CONFIG });
    await signer.init();

    const addresses = signer.getAddresses();
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toBe(MOCK_FEE_PAYER);
  });

  it("sends signTransaction RPC call", async () => {
    const fetchMock = mockKoraFetch({
      getPayerSigner: { signer_address: MOCK_FEE_PAYER, payment_address: MOCK_FEE_PAYER },
      signTransaction: { signature: "sig123", signed_transaction: "signed-base64-tx", signer_pubkey: MOCK_FEE_PAYER },
    });
    vi.stubGlobal("fetch", fetchMock);

    const signer = createKoraFacilitatorSvmSigner({ config: MOCK_CONFIG });
    await signer.init();

    const result = await signer.signTransaction(
      "unsigned-base64-tx",
      MOCK_FEE_PAYER as any,
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    );
    expect(result).toBe("signed-base64-tx");
  });

  it("sends signAndSendTransaction RPC call", async () => {
    const fetchMock = mockKoraFetch({
      getPayerSigner: { signer_address: MOCK_FEE_PAYER, payment_address: MOCK_FEE_PAYER },
      signAndSendTransaction: { signature: "5abc123signature", signed_transaction: "signed-base64-tx", signer_pubkey: MOCK_FEE_PAYER },
    });
    vi.stubGlobal("fetch", fetchMock);

    const signer = createKoraFacilitatorSvmSigner({ config: MOCK_CONFIG });
    await signer.init();

    const sig = await signer.sendTransaction(
      "signed-base64-tx",
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    );
    expect(sig).toBe("5abc123signature");
  });

  it("includes API key header when configured", async () => {
    const configWithKey: KoraConfig = {
      rpcUrl: "http://localhost:8080",
      apiKey: "test-api-key-123",
    };
    const fetchMock = mockKoraFetch({ getPayerSigner: { signer_address: MOCK_FEE_PAYER, payment_address: MOCK_FEE_PAYER } });
    vi.stubGlobal("fetch", fetchMock);

    const signer = createKoraFacilitatorSvmSigner({ config: configWithKey });
    await signer.init();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key-123",
        }),
      }),
    );
  });

  it("throws on Kora RPC error", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "Insufficient funds" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const signer = createKoraFacilitatorSvmSigner({ config: MOCK_CONFIG });
    await expect(signer.init()).rejects.toThrow("Insufficient funds");
  });
});
