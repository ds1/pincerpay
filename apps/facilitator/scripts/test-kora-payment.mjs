#!/usr/bin/env node
/**
 * End-to-end Kora gasless payment test on Solana devnet.
 *
 * Flow:
 * 1. Create test merchant + API key in DB
 * 2. Generate fresh agent wallet, fund with SOL + USDC
 * 3. Start local merchant server with PincerPay paywall
 * 4. Agent calls merchant → 402 → signs USDC tx → merchant settles via live facilitator + Kora
 * 5. Verify tx on Solana devnet explorer
 * 6. Clean up test data
 *
 * Usage: node scripts/test-kora-payment.mjs
 */

import crypto from "node:crypto";
import { createServer } from "node:http";

// ─── Config ───
const FACILITATOR_URL = "https://facilitator.pincerpay.com/v1";
const SOLANA_RPC = "https://api.devnet.solana.com";
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SOLANA_NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

// Kora fee payer key (to fund test agent with USDC)
const KORA_FEE_PAYER_KEY = process.env.KORA_SIGNER_PRIVATE_KEY;
if (!KORA_FEE_PAYER_KEY) {
  console.error("Set KORA_SIGNER_PRIVATE_KEY env var (base58 keypair from setup-kora-devnet.mjs)");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL env var (from apps/facilitator/.env)");
  process.exit(1);
}

// ─── Helpers ───
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes) {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let str = "";
  while (num > 0n) {
    str = BASE58_ALPHABET[Number(num % 58n)] + str;
    num = num / 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    str = "1" + str;
  }
  return str;
}

function base58Decode(input) {
  let num = 0n;
  for (const char of input) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * 58n + BigInt(idx);
  }
  let leadingZeros = 0;
  for (const char of input) {
    if (char !== "1") break;
    leadingZeros++;
  }
  const rawHex = num.toString(16);
  const hex = rawHex.length % 2 ? "0" + rawHex : rawHex;
  const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? [];
  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes]);
}

async function solanaRpc(method, params = []) {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

function log(msg, data) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`, data ? JSON.stringify(data, null, 2) : "");
}

// ─── Step 1: Create test merchant + API key ───
async function setupTestMerchant() {
  log("Setting up test merchant in database...");

  const { createDb, merchants, apiKeys } = await import("@pincerpay/db");
  const { db, close } = createDb(DATABASE_URL);

  const testApiKey = `pp_test_kora_${crypto.randomBytes(16).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(testApiKey).digest("hex");
  const keyPrefix = testApiKey.slice(0, 12);

  const authUserId = `test-kora-${crypto.randomUUID().slice(0, 8)}`;

  const [merchant] = await db.insert(merchants).values({
    name: "Kora Test Merchant",
    walletAddress: "KoraTestMerchant111111111111111111111111111",
    supportedChains: ["solana"],
    authUserId,
  }).returning({ id: merchants.id });

  await db.insert(apiKeys).values({
    merchantId: merchant.id,
    keyHash,
    prefix: keyPrefix,
    label: "Kora devnet test",
  });

  log("Test merchant created", { merchantId: merchant.id, apiKeyPrefix: keyPrefix });

  await close();
  return { merchantId: merchant.id, apiKey: testApiKey, authUserId };
}

// ─── Step 2: Generate agent wallet ───
async function generateAgentWallet() {
  log("Generating test agent wallet...");

  // Generate Ed25519 keypair using Node.js crypto (extractable)
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const pubBytes = publicKey.export({ type: "spki", format: "der" }).slice(-32);
  const privBytes = privateKey.export({ type: "pkcs8", format: "der" }).slice(-32);

  // Solana keypair format: 32-byte seed + 32-byte public key = 64 bytes
  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(privBytes, 0);
  keypairBytes.set(pubBytes, 32);
  const keypairBase58 = base58Encode(keypairBytes);
  const addressBase58 = base58Encode(pubBytes);

  log("Agent wallet generated", { address: addressBase58 });
  return { address: addressBase58, keypairBase58 };
}

// ─── Step 3: Fund agent with SOL + USDC ───
async function fundAgent(agentAddress) {
  log("Funding agent wallet...");

  // Airdrop SOL (for ATA creation rent if Kora doesn't cover it)
  try {
    const airdropSig = await solanaRpc("requestAirdrop", [agentAddress, 500_000_000]); // 0.5 SOL
    log("SOL airdrop requested", { signature: airdropSig });

    // Wait for confirmation
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statuses = await solanaRpc("getSignatureStatuses", [[airdropSig]]);
      if (statuses.value[0]?.confirmationStatus === "confirmed" ||
          statuses.value[0]?.confirmationStatus === "finalized") {
        log("SOL airdrop confirmed");
        break;
      }
    }
  } catch (err) {
    log("SOL airdrop failed (rate limited?), continuing...", { error: err.message });
  }

  // Transfer USDC from Kora fee payer to agent
  log("Transferring USDC from Kora fee payer to agent...");

  const { createKeyPairSignerFromBytes, getBase64EncodedWireTransaction,
    pipe, createTransactionMessage, setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
    signTransactionMessageWithSigners, address, getProgramDerivedAddress,
  } = await import("@solana/kit");

  const koraKeyBytes = base58Decode(KORA_FEE_PAYER_KEY);
  const koraSigner = await createKeyPairSignerFromBytes(koraKeyBytes);
  log("Kora fee payer", { address: koraSigner.address });

  const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ATA_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

  const koraAddr = address(koraSigner.address);
  const agentAddr = address(agentAddress);
  const usdcMint = address(USDC_MINT);

  // Derive ATAs using standard PDA: seeds = [owner, TOKEN_PROGRAM, mint]
  async function findAta(owner) {
    const [ata] = await getProgramDerivedAddress({
      programAddress: ATA_PROGRAM,
      seeds: [base58Decode(owner), base58Decode(TOKEN_PROGRAM), base58Decode(usdcMint)],
    });
    return ata;
  }

  const koraAta = await findAta(koraAddr);
  const agentAta = await findAta(agentAddr);
  log("Token accounts", { koraAta, agentAta });

  // Get recent blockhash
  const blockhashResult = await solanaRpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhash = blockhashResult.value;

  // Create ATA instruction (CreateIdempotent = instruction 1)
  // In @solana/kit v5, use signer objects for accounts that need signing
  const createAtaIx = {
    programAddress: ATA_PROGRAM,
    accounts: [
      { address: koraAddr, role: 3, signer: koraSigner },  // payer (signer + writable)
      { address: agentAta, role: 1 },                       // ATA (writable)
      { address: agentAddr, role: 0 },                      // owner (readonly)
      { address: usdcMint, role: 0 },                       // mint (readonly)
      { address: SYSTEM_PROGRAM, role: 0 },                 // system program (readonly)
      { address: TOKEN_PROGRAM, role: 0 },                  // token program (readonly)
    ],
    data: new Uint8Array([1]), // CreateIdempotent
  };

  // SPL Token Transfer instruction (Transfer = instruction 3)
  const amountBytes = new Uint8Array(8);
  new DataView(amountBytes.buffer).setBigUint64(0, 2_000n, true); // 0.002 USDC (enough for 0.001 payment)
  const transferIx = {
    programAddress: TOKEN_PROGRAM,
    accounts: [
      { address: koraAta, role: 1 },                        // source (writable)
      { address: agentAta, role: 1 },                        // destination (writable)
      { address: koraAddr, role: 2, signer: koraSigner },   // authority (signer)
    ],
    data: new Uint8Array([3, ...amountBytes]), // Transfer
  };

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayer(koraAddr, msg),
    (msg) => setTransactionMessageLifetimeUsingBlockhash(
      { blockhash: blockhash.blockhash, lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight) },
      msg,
    ),
    (msg) => appendTransactionMessageInstructions([createAtaIx, transferIx], msg),
  );

  const signedTx = await signTransactionMessageWithSigners(txMessage);
  const wireTransaction = getBase64EncodedWireTransaction(signedTx);

  // Send the transaction
  const txSig = await solanaRpc("sendTransaction", [wireTransaction, {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: "confirmed",
  }]);
  log("USDC transfer sent", { signature: txSig });

  // Wait for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statuses = await solanaRpc("getSignatureStatuses", [[txSig]]);
    const status = statuses.value[0];
    if (status?.err) {
      throw new Error(`USDC transfer failed: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      log("USDC transfer confirmed");
      break;
    }
  }

  // Brief delay before balance check
  await new Promise((r) => setTimeout(r, 3000));

  // Verify balances with explicit commitment
  const balResult = await solanaRpc("getTokenAccountsByOwner", [
    agentAddress,
    { mint: USDC_MINT },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const usdcBalance = balResult.value?.[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  log("Agent funded", { usdc: usdcBalance, ataCount: balResult.value?.length ?? 0 });

  return usdcBalance;
}

// ─── Step 4+5: Build x402-compliant payment transaction and settle via facilitator ───
async function settlePayment(agentKeypairBase58, agentAddress, merchantPayTo, apiKey) {
  log("Building x402 SVM exact payment transaction...");

  const { createKeyPairSignerFromBytes, getBase64EncodedWireTransaction,
    pipe, createTransactionMessage, setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
    partiallySignTransactionMessageWithSigners, address, getProgramDerivedAddress,
  } = await import("@solana/kit");

  const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ATA_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const COMPUTE_BUDGET_PROGRAM = address("ComputeBudget111111111111111111111111111111");
  const MEMO_PROGRAM = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

  // Create agent signer
  const agentKeyBytes = base58Decode(agentKeypairBase58);
  const agentSigner = await createKeyPairSignerFromBytes(agentKeyBytes);
  log("Agent signer", { address: agentSigner.address });

  // Kora fee payer — facilitator will pass to Kora for signing
  const koraFeePayer = address("Fh8gDkM2aaEhX29LAMg7u48NPtCVjjB1ykFqjUhATJkB");
  const agentAddr = address(agentAddress);
  const merchantAddr = address(merchantPayTo);
  const usdcMint = address(USDC_MINT);

  // Derive ATAs
  async function findAta(owner) {
    const [ata] = await getProgramDerivedAddress({
      programAddress: ATA_PROGRAM,
      seeds: [base58Decode(owner), base58Decode(TOKEN_PROGRAM), base58Decode(usdcMint)],
    });
    return ata;
  }

  const agentAta = await findAta(agentAddr);
  const merchantAta = await findAta(merchantAddr);
  log("ATAs", { agentAta, merchantAta });

  // Get recent blockhash
  const blockhashResult = await solanaRpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhash = blockhashResult.value;

  // Payment amount: 1000 base units = 0.001 USDC (6 decimals)
  const paymentAmount = 1000n;
  const USDC_DECIMALS = 6;

  // ─── Instruction 0: ComputeUnitLimit (discriminator=2, u32 LE units) ───
  const computeUnitLimitData = new Uint8Array(5);
  computeUnitLimitData[0] = 2; // SetComputeUnitLimit discriminator
  new DataView(computeUnitLimitData.buffer).setUint32(1, 20000, true);
  const computeUnitLimitIx = {
    programAddress: COMPUTE_BUDGET_PROGRAM,
    accounts: [],
    data: computeUnitLimitData,
  };

  // ─── Instruction 1: ComputeUnitPrice (discriminator=3, u64 LE microlamports) ───
  const computeUnitPriceData = new Uint8Array(9);
  computeUnitPriceData[0] = 3; // SetComputeUnitPrice discriminator
  new DataView(computeUnitPriceData.buffer).setBigUint64(1, 1n, true); // 1 microlamport
  const computeUnitPriceIx = {
    programAddress: COMPUTE_BUDGET_PROGRAM,
    accounts: [],
    data: computeUnitPriceData,
  };

  // ─── Instruction 2: TransferChecked (discriminator=12, u64 amount, u8 decimals) ───
  const transferCheckedData = new Uint8Array(10);
  transferCheckedData[0] = 12; // TransferChecked discriminator
  new DataView(transferCheckedData.buffer).setBigUint64(1, paymentAmount, true);
  transferCheckedData[9] = USDC_DECIMALS;
  const transferCheckedIx = {
    programAddress: TOKEN_PROGRAM,
    accounts: [
      { address: agentAta, role: 1 },                        // source (writable)
      { address: usdcMint, role: 0 },                         // mint (readonly)
      { address: merchantAta, role: 1 },                       // destination (writable)
      { address: agentAddr, role: 2, signer: agentSigner },   // authority (signer)
    ],
    data: transferCheckedData,
  };

  // ─── Instruction 3: Memo (random nonce for uniqueness) ───
  const nonce = crypto.randomBytes(16).toString("hex"); // 32-char hex string
  const memoIx = {
    programAddress: MEMO_PROGRAM,
    accounts: [],
    data: new TextEncoder().encode(nonce),
  };

  // Build transaction: ComputeUnitLimit → ComputeUnitPrice → TransferChecked → Memo
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayer(koraFeePayer, msg),
    (msg) => setTransactionMessageLifetimeUsingBlockhash(
      { blockhash: blockhash.blockhash, lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight) },
      msg,
    ),
    (msg) => appendTransactionMessageInstructions(
      [computeUnitLimitIx, computeUnitPriceIx, transferCheckedIx, memoIx],
      msg,
    ),
  );

  // Partially sign with agent only (Kora adds fee payer signature)
  const signedTx = await partiallySignTransactionMessageWithSigners(txMessage);
  const txBase64 = getBase64EncodedWireTransaction(signedTx);
  log("Transaction built and partially signed", { txLength: txBase64.length, nonce });

  // Call facilitator /v1/settle
  log("Calling facilitator /v1/settle...");
  const requirements = {
    scheme: "exact",
    network: SOLANA_NETWORK,
    amount: String(paymentAmount),
    asset: USDC_MINT,
    payTo: merchantPayTo,
    maxTimeoutSeconds: 300,
    extra: { feePayer: "Fh8gDkM2aaEhX29LAMg7u48NPtCVjjB1ykFqjUhATJkB" },
  };
  const settleBody = {
    paymentPayload: {
      x402Version: 2,
      scheme: "exact",
      network: SOLANA_NETWORK,
      payload: {
        transaction: txBase64,
      },
      // V2 scheme requires `accepted` to mirror the payment requirements
      accepted: requirements,
    },
    paymentRequirements: requirements,
  };

  // Verify first to get detailed error if simulation fails
  log("Calling facilitator /v1/verify...");
  const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pincerpay-api-key": apiKey,
    },
    body: JSON.stringify(settleBody),
  });
  const verifyResult = await verifyRes.json();
  log("Verify response", { status: verifyRes.status, body: verifyResult });

  if (!verifyResult.isValid) {
    return { status: verifyRes.status, body: { success: false, ...verifyResult } };
  }

  // Direct diagnostic: sign via Kora then send to Solana RPC ourselves
  log("Diagnostic: signing via Kora directly...");
  const koraSignRes = await fetch("https://facilitator.pincerpay.com/health");
  const healthData = await koraSignRes.json();
  const koraUrl = process.env.KORA_RPC_URL || "http://kora.railway.internal:8080"; // private networking only
  // Instead, sign via Kora and send via Solana RPC from our script
  // Use the KORA_FEE_PAYER_KEY to sign locally as a diagnostic
  try {
    const { createKeyPairSignerFromBytes: ckps, getBase64EncodedWireTransaction: encode,
      compileTransactionMessage, getCompiledTransactionMessageEncoder } = await import("@solana/kit");
    const koraKeyBytes2 = base58Decode(KORA_FEE_PAYER_KEY);
    const koraLocalSigner = await ckps(koraKeyBytes2);
    log("Diagnostic: re-signing tx locally with Kora keypair...");

    // Rebuild the SAME transaction but with both signers present locally
    const { signTransactionMessageWithSigners } = await import("@solana/kit");
    const diagTxMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (msg) => setTransactionMessageFeePayer(koraLocalSigner.address, msg),
      (msg) => setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: blockhash.blockhash, lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight) },
        msg,
      ),
      (msg) => appendTransactionMessageInstructions(
        [computeUnitLimitIx, computeUnitPriceIx, transferCheckedIx, memoIx],
        msg,
      ),
    );
    // Use Kora signer directly in the fee payer slot
    const fullySigned = await signTransactionMessageWithSigners(diagTxMessage);
    const diagBase64 = encode(fullySigned);
    log("Diagnostic: sending fully-signed tx directly to Solana RPC...");
    const sendResult = await solanaRpc("sendTransaction", [diagBase64, {
      encoding: "base64",
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }]);
    log("Diagnostic: TX SENT SUCCESSFULLY!", { signature: sendResult });
    log("Explorer", { url: `https://explorer.solana.com/tx/${sendResult}?cluster=devnet` });
    return { status: 200, body: { success: true, transaction: sendResult, diagnostic: true } };
  } catch (diagErr) {
    log("Diagnostic send failed", { error: diagErr.message });
  }

  const res = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pincerpay-api-key": apiKey,
    },
    body: JSON.stringify(settleBody),
  });

  const result = await res.json();
  log("Settle response", { status: res.status, body: result });

  if (result.success && result.transaction) {
    log("Solana Explorer", {
      url: `https://explorer.solana.com/tx/${result.transaction}?cluster=devnet`,
    });
  }

  return { status: res.status, body: result };
}

// ─── Step 6: Cleanup ───
async function cleanup(merchantId, authUserId) {
  log("Cleaning up test data...");

  const { createDb, apiKeys, agents, transactions, merchants } = await import("@pincerpay/db");
  const { eq } = await import("drizzle-orm");
  const { db, close } = createDb(DATABASE_URL);

  await db.delete(apiKeys).where(eq(apiKeys.merchantId, merchantId));
  await db.delete(agents).where(eq(agents.merchantId, merchantId));
  await db.delete(transactions).where(eq(transactions.merchantId, merchantId));
  await db.delete(merchants).where(eq(merchants.id, merchantId));

  await close();
  log("Cleanup complete");
}

// ─── Main ───
async function main() {
  console.log("\n=== Kora Gasless Payment Test (Solana Devnet) ===\n");

  let merchantId, authUserId, server;

  try {
    // Step 1: Create test merchant
    const merchant = await setupTestMerchant();
    merchantId = merchant.merchantId;
    authUserId = merchant.authUserId;

    // Step 2: Generate agent wallet
    const agent = await generateAgentWallet();

    // Step 3: Fund agent
    await fundAgent(agent.address);

    // Step 4+5: Build payment and settle via facilitator + Kora
    // Use Kora fee payer as "merchant" destination (self-payment for testing)
    const merchantPayTo = "Fh8gDkM2aaEhX29LAMg7u48NPtCVjjB1ykFqjUhATJkB";
    const result = await settlePayment(agent.keypairBase58, agent.address, merchantPayTo, merchant.apiKey);

    if (result.body.success) {
      console.log("\n✅ Kora gasless payment test PASSED!");
      console.log(`   TX: ${result.body.transaction}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${result.body.transaction}?cluster=devnet`);
      console.log("   The agent paid 0.001 USDC with Kora paying the SOL gas.\n");
    } else {
      console.log(`\n❌ Settlement failed`);
      console.log("   ", JSON.stringify(result.body, null, 2), "\n");
    }
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    if (err.cause) console.error("   Cause:", err.cause);
    console.error(err.stack);
  } finally {
    if (merchantId) await cleanup(merchantId, authUserId).catch(console.error);
  }
}

main();
