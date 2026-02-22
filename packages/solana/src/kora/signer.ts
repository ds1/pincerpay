import type { Address } from "@solana/kit";
import { createSolanaRpc, signature } from "@solana/kit";
import type { FacilitatorSvmSigner } from "@x402/svm";
import type { KoraConfig } from "./config.js";

/**
 * Kora RPC client interface — minimal subset of JSON-RPC methods we use.
 * Kora exposes standard Solana RPC + custom methods for gasless transactions.
 */
interface KoraPayerSignerResult {
  signer_address: string;
  payment_address: string;
}

interface KoraRpcClient {
  /** Fetch the Kora signer node's payer signer info (address + payment destination) */
  getPayerSigner(): Promise<KoraPayerSignerResult>;
  /** Sign a base64-encoded transaction with the Kora fee payer */
  signTransaction(params: { transaction: string }): Promise<{ transaction: string }>;
  /** Sign and send a base64-encoded transaction via the Kora signer node */
  signAndSendTransaction(params: { transaction: string }): Promise<{ signature: string }>;
}

/**
 * Minimal Kora JSON-RPC client. Calls Kora's custom RPC methods.
 */
function createKoraClient(config: KoraConfig): KoraRpcClient {
  let requestId = 0;

  async function rpcCall<T>(method: string, params?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const res = await fetch(config.rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method,
        params: params ?? [],
      }),
    });

    if (!res.ok) {
      throw new Error(`Kora RPC error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { result?: T; error?: { message: string; code: number } };
    if (json.error) {
      throw new Error(`Kora RPC error [${json.error.code}]: ${json.error.message}`);
    }
    return json.result as T;
  }

  return {
    getPayerSigner: () => rpcCall<KoraPayerSignerResult>("getPayerSigner"),
    signTransaction: (params) => rpcCall<{ transaction: string }>("signTransaction", params),
    signAndSendTransaction: (params) => rpcCall<{ signature: string }>("signAndSendTransaction", params),
  };
}

interface KoraFacilitatorSvmSignerOptions {
  config: KoraConfig;
  /** Override Solana RPC URLs per network (CAIP-2 → URL) */
  rpcUrls?: Record<string, string>;
}

/**
 * Creates a FacilitatorSvmSigner backed by a Kora signer node.
 *
 * Kora handles fee payment in USDC (or other SPL tokens) instead of SOL.
 * The facilitator delegates transaction signing to the Kora node which:
 * 1. Adds its fee payer as the transaction fee payer
 * 2. Signs the transaction with its fee payer key
 * 3. Charges the agent in USDC for gas costs
 *
 * IMPORTANT: Call `await signer.init()` before using — fetches the fee payer address.
 */
export function createKoraFacilitatorSvmSigner(
  options: KoraFacilitatorSvmSignerOptions,
): FacilitatorSvmSigner & { init(): Promise<void> } {
  const { config, rpcUrls } = options;
  const kora = createKoraClient(config);

  // Cached fee payer address — populated during init()
  let feePayerAddress: Address | null = null;

  // Cache Solana RPC connections for simulation/confirmation
  const rpcCache = new Map<string, ReturnType<typeof createSolanaRpc>>();

  function getSolanaRpc(network: string) {
    let rpc = rpcCache.get(network);
    if (!rpc) {
      const url = rpcUrls?.[network] ?? "https://api.devnet.solana.com";
      rpc = createSolanaRpc(url);
      rpcCache.set(network, rpc);
    }
    return rpc;
  }

  const signer: FacilitatorSvmSigner & { init(): Promise<void> } = {
    /**
     * Fetch the Kora fee payer address. Must be called before getAddresses().
     */
    async init() {
      const result = await kora.getPayerSigner();
      feePayerAddress = result.signer_address as Address;
    },

    getAddresses(): readonly Address[] {
      if (!feePayerAddress) {
        throw new Error("KoraFacilitatorSvmSigner not initialized — call init() first");
      }
      return [feePayerAddress];
    },

    async signTransaction(transaction: string, _feePayer: Address, _network: string): Promise<string> {
      const result = await kora.signTransaction({ transaction });
      return result.transaction;
    },

    async simulateTransaction(transaction: string, network: string): Promise<void> {
      const rpc = getSolanaRpc(network);
      // Simulate using the standard Solana RPC — cast transaction to expected encoded type
      const result = await rpc
        .simulateTransaction(transaction as Parameters<typeof rpc.simulateTransaction>[0], {
          commitment: "confirmed",
          replaceRecentBlockhash: true,
          encoding: "base64",
        })
        .send();

      if (result.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(result.value.err)}`);
      }
    },

    async sendTransaction(transaction: string, _network: string): Promise<string> {
      const result = await kora.signAndSendTransaction({ transaction });
      return result.signature;
    },

    async confirmTransaction(sig: string, network: string): Promise<void> {
      const rpc = getSolanaRpc(network);
      const brandedSig = signature(sig);

      // Poll for confirmation with timeout
      const timeout = 30_000;
      const interval = 2_000;
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const statuses = await rpc
          .getSignatureStatuses([brandedSig], { searchTransactionHistory: true })
          .send();

        const status = statuses.value[0];
        if (status) {
          if (status.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
          }
          if (
            status.confirmationStatus === "confirmed" ||
            status.confirmationStatus === "finalized"
          ) {
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      throw new Error(`Transaction confirmation timed out after ${timeout}ms`);
    },
  };

  return signer;
}

export { createKoraClient, type KoraRpcClient };
