import { generateMnemonic, mnemonicToSeed, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { derivePath } from "ed25519-hd-key";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

export const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
export const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0";

export interface ChainWallet {
  address: string;
  privateKey: string;
  derivationPath: string;
}

export interface MerchantWallets {
  mnemonic: string;
  solana: ChainWallet;
  evm: ChainWallet;
}

export interface GenerateOptions {
  /** 12 (default) or 24 words. 12 is standard for Phantom + MetaMask. */
  strength?: 128 | 256;
  /** Use a specific mnemonic instead of generating one. Must be BIP-39 valid. */
  mnemonic?: string;
}

/**
 * Generate a non-custodial merchant wallet set.
 *
 * Returns one BIP-39 mnemonic plus Solana + EVM addresses derived from it.
 * The mnemonic is Phantom-compatible (Solana m/44'/501'/0'/0') and
 * MetaMask-compatible (EVM m/44'/60'/0'/0/0). The merchant can import the
 * mnemonic into either wallet to recover full control.
 *
 * Private keys are returned alongside addresses for environments that don't
 * use a wallet UI (servers, CLIs). Callers must handle them with care.
 * PincerPay never stores or transmits the mnemonic or private keys.
 */
export async function generateMerchantWallets(
  options: GenerateOptions = {},
): Promise<MerchantWallets> {
  const mnemonic = options.mnemonic ?? generateMnemonic(wordlist, options.strength ?? 128);
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid BIP-39 mnemonic");
  }

  const seed = await mnemonicToSeed(mnemonic);

  return {
    mnemonic,
    solana: deriveSolana(seed),
    evm: deriveEvm(seed),
  };
}

function deriveSolana(seed: Uint8Array): ChainWallet {
  const seedHex = Buffer.from(seed).toString("hex");
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seedHex);
  const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(key));
  return {
    address: bs58.encode(keypair.publicKey),
    privateKey: bs58.encode(keypair.secretKey),
    derivationPath: SOLANA_DERIVATION_PATH,
  };
}

function deriveEvm(seed: Uint8Array): ChainWallet {
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(EVM_DERIVATION_PATH);
  if (!child.privateKey) throw new Error("EVM derivation produced no private key");
  const privateKey = (`0x${Buffer.from(child.privateKey).toString("hex")}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    privateKey,
    derivationPath: EVM_DERIVATION_PATH,
  };
}
