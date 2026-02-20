import { describe, it, expect, vi, beforeEach } from "vitest";
import { FacilitatorClient } from "../client.js";

describe("FacilitatorClient", () => {
  describe("constructor", () => {
    it("uses default facilitator URL when none provided", () => {
      const client = new FacilitatorClient({});
      expect(client.facilitatorUrl).toBe(
        "https://facilitator.pincerpay.com",
      );
    });

    it("uses custom facilitator URL when provided", () => {
      const client = new FacilitatorClient({
        facilitatorUrl: "http://localhost:4402",
      });
      expect(client.facilitatorUrl).toBe("http://localhost:4402");
    });
  });

  describe("isAuthenticated", () => {
    it("returns false without API key", () => {
      const client = new FacilitatorClient({});
      expect(client.isAuthenticated).toBe(false);
    });

    it("returns true with API key", () => {
      const client = new FacilitatorClient({ apiKey: "pp_live_test" });
      expect(client.isAuthenticated).toBe(true);
    });
  });

  describe("requireAuth", () => {
    it("throws without API key", () => {
      const client = new FacilitatorClient({});
      expect(() => client.requireAuth()).toThrow(
        "This operation requires a PincerPay API key",
      );
    });

    it("does not throw with API key", () => {
      const client = new FacilitatorClient({ apiKey: "pp_live_test" });
      expect(() => client.requireAuth()).not.toThrow();
    });
  });

  describe("request", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("sends GET request without body", async () => {
      const mockResponse = { status: "ok" };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const client = new FacilitatorClient({
        facilitatorUrl: "http://localhost:4402",
      });
      const result = await client.request("/health");

      expect(fetch).toHaveBeenCalledWith("http://localhost:4402/health", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it("sends POST request with body", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const client = new FacilitatorClient({
        facilitatorUrl: "http://localhost:4402",
        apiKey: "pp_live_test",
      });
      await client.request("/v1/verify", { payload: "data" });

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4402/v1/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-pincerpay-api-key": "pp_live_test",
          },
          body: JSON.stringify({ payload: "data" }),
        },
      );
    });

    it("includes API key header when configured", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const client = new FacilitatorClient({
        facilitatorUrl: "http://localhost:4402",
        apiKey: "pp_live_abc",
      });
      await client.request("/health");

      const callArgs = vi.mocked(fetch).mock.calls[0]!;
      const headers = (callArgs[1] as RequestInit).headers as Record<
        string,
        string
      >;
      expect(headers["x-pincerpay-api-key"]).toBe("pp_live_abc");
    });

    it("throws on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 }),
      );

      const client = new FacilitatorClient({
        facilitatorUrl: "http://localhost:4402",
      });

      await expect(client.request("/missing")).rejects.toThrow(
        "Facilitator /missing failed (404): Not Found",
      );
    });
  });
});
