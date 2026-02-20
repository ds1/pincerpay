#!/usr/bin/env node
/**
 * Initialize the PincerPay Anchor program on devnet:
 * 1. Call `initialize(fee_bps=100)` — 1% fee
 * 2. Call `register_merchant` for a test merchant
 *
 * Uses @solana/web3.js v1 from /tmp/anchor-init/node_modules
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

const require = createRequire(import.meta.url);
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("E53zfNo9DYxAUCu37bA2NakJMMbzPFszjgB5kPaTMvF3");
const DEVNET_URL = "https://api.devnet.solana.com";

const scriptDir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const keypairData = JSON.parse(readFileSync(resolve(scriptDir, ".keypair.json"), "utf-8"));

const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

console.log("Authority:", authority.publicKey.toBase58());
console.log("Program:", PROGRAM_ID.toBase58());

const connection = new Connection(DEVNET_URL, "confirmed");

// Derive Config PDA: seeds = ["config"]
const [configPda, configBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  PROGRAM_ID,
);
console.log("Config PDA:", configPda.toBase58());

// ─── Step 1: Initialize ───
const initDiscriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
const feeBps = 100; // 1%
const feeBpsBuffer = Buffer.alloc(2);
feeBpsBuffer.writeUInt16LE(feeBps);

const initData = Buffer.concat([initDiscriminator, feeBpsBuffer]);

const initIx = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: initData,
});

console.log("\nInitializing program (fee_bps=100)...");
try {
  const initTx = new Transaction().add(initIx);
  const initSig = await sendAndConfirmTransaction(connection, initTx, [authority]);
  console.log("Initialize success:", initSig);
} catch (err) {
  if (err.message?.includes("already in use")) {
    console.log("Program already initialized — skipping");
  } else {
    console.error("Initialize failed:", err.message);
    process.exit(1);
  }
}

// ─── Step 2: Register test merchant ───
// Use a deterministic test merchant ID (UUID as bytes)
const testMerchantUuid = "00000000-0000-0000-0000-000000000001";
const merchantIdBytes = Buffer.from(testMerchantUuid.replace(/-/g, ""), "hex");

// Derive Merchant PDA: seeds = ["merchant", merchant_id_bytes]
const [merchantPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("merchant"), merchantIdBytes],
  PROGRAM_ID,
);
console.log("\nMerchant PDA:", merchantPda.toBase58());

// Test merchant owner = authority (for now)
const merchantOwner = authority.publicKey;

// Create a dummy USDC ATA address for test merchant (we'll use a real one later)
// For devnet testing, use a derived address
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// Derive ATA manually (same as getAssociatedTokenAddressSync)
const [merchantUsdcAta] = PublicKey.findProgramAddressSync(
  [merchantOwner.toBuffer(), TOKEN_PROGRAM.toBuffer(), USDC_DEVNET_MINT.toBuffer()],
  ATA_PROGRAM,
);
console.log("Merchant USDC ATA:", merchantUsdcAta.toBase58());

// Compute Anchor discriminator: sha256("global:register_merchant")[0..8]
const registerDiscriminator = crypto.createHash("sha256").update("global:register_merchant").digest().subarray(0, 8);
const nameBytes = Buffer.alloc(32);
nameBytes.write("Test Merchant", "utf-8");

const registerData = Buffer.concat([
  registerDiscriminator,
  merchantIdBytes,  // [u8; 16]
  nameBytes,        // [u8; 32]
]);

const registerIx = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: merchantPda, isSigner: false, isWritable: true },
    { pubkey: merchantOwner, isSigner: false, isWritable: false },
    { pubkey: merchantUsdcAta, isSigner: false, isWritable: false },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: registerData,
});

console.log("Registering test merchant...");
try {
  const regTx = new Transaction().add(registerIx);
  const regSig = await sendAndConfirmTransaction(connection, regTx, [authority]);
  console.log("Register merchant success:", regSig);
} catch (err) {
  if (err.message?.includes("already in use")) {
    console.log("Merchant already registered — skipping");
  } else {
    console.error("Register merchant failed:", err.message);
    process.exit(1);
  }
}

console.log("\nProgram initialization complete!");
console.log("Program ID:", PROGRAM_ID.toBase58());
console.log("Authority:", authority.publicKey.toBase58());
console.log("Config PDA:", configPda.toBase58());
console.log("Test Merchant PDA:", merchantPda.toBase58());
