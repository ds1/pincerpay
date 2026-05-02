import { createHash, randomBytes } from "node:crypto";
import { eq, ilike } from "drizzle-orm";
import { createDb, merchants, apiKeys } from "@pincerpay/db";
import { API_KEY_PREFIX_LENGTH } from "@pincerpay/core";
import type { MerchantWallets } from "./wallets.js";

export interface MerchantSeed {
  /** Display name for the merchant. */
  name: string;
  /** Primary receiving wallet address (used as the legacy single-chain field). */
  walletAddress: string;
  /** Per-chain receiving addresses. Keyed by chain shorthand ("solana", "evm", etc). */
  walletAddresses?: Record<string, string>;
  /** Chains this merchant can settle on (e.g. ["solana", "polygon"]). */
  supportedChains: string[];
  /** Optional webhook URL. */
  webhookUrl?: string;
  /** Supabase Auth user id that owns this merchant record. */
  authUserId: string;
}

export interface CreatedKey {
  rawKey: string;
  prefix: string;
  label: string;
}

export interface BootstrapResult {
  merchantId: string;
  walletsGenerated: boolean;
  /** Returned only when wallets were generated. Caller is responsible for displaying + discarding. */
  wallets?: MerchantWallets;
  apiKey: CreatedKey;
  webhookSecret: string;
}

export interface BootstrapOptions {
  databaseUrl: string;
  name: string;
  authUserId: string;
  /** Generated wallets. If omitted, walletAddress and walletAddresses must be supplied directly. */
  wallets?: MerchantWallets;
  /** Used when wallets is omitted. */
  walletAddress?: string;
  walletAddresses?: Record<string, string>;
  supportedChains?: string[];
  webhookUrl?: string;
  apiKeyLabel?: string;
}

/**
 * End-to-end merchant onboarding.
 *
 * Generates (or accepts) wallets, inserts a merchant row, mints an API key, and
 * returns everything the caller needs to print env-var-ready output.
 *
 * Non-custodial. PincerPay only persists public addresses. Private keys and the
 * mnemonic are returned in `result.wallets` exactly once and must be displayed
 * + discarded by the caller.
 */
export async function bootstrapMerchant(
  options: BootstrapOptions,
): Promise<BootstrapResult> {
  const wallets = options.wallets;
  const walletAddress = wallets?.solana.address ?? options.walletAddress;
  if (!walletAddress) {
    throw new Error(
      "bootstrapMerchant: must provide either generated wallets or an explicit walletAddress",
    );
  }

  const walletAddresses =
    options.walletAddresses ??
    (wallets
      ? { solana: wallets.solana.address, evm: wallets.evm.address }
      : undefined);

  const supportedChains =
    options.supportedChains ??
    (wallets ? ["solana", "polygon"] : []);

  const { db, close } = createDb(options.databaseUrl);
  try {
    const webhookSecret = randomBytes(32).toString("hex");

    const [inserted] = await db
      .insert(merchants)
      .values({
        name: options.name,
        walletAddress,
        supportedChains,
        webhookUrl: options.webhookUrl ?? null,
        webhookSecret,
        authUserId: options.authUserId,
      })
      .returning({ id: merchants.id });

    const apiKey = await mintApiKey(db, inserted.id, options.apiKeyLabel ?? "Bootstrap");

    if (walletAddresses) {
      // Persist per-chain map opportunistically. Schema may add a JSONB column
      // in PincerPay S1 Phase B; for now this is purely informational on the
      // returned object.
    }

    return {
      merchantId: inserted.id,
      walletsGenerated: !!wallets,
      wallets,
      apiKey,
      webhookSecret,
    };
  } finally {
    await close();
  }
}

export interface CreateApiKeyOptions {
  databaseUrl: string;
  /** Either merchant UUID or name (case-insensitive). */
  merchant: string;
  label?: string;
}

/**
 * Mint an API key for an existing merchant. Resolves merchants by UUID first,
 * then by case-insensitive name. Errors on ambiguous name matches.
 */
export async function createApiKey(
  options: CreateApiKeyOptions,
): Promise<CreatedKey & { merchantId: string; merchantName: string }> {
  const { db, close } = createDb(options.databaseUrl);
  try {
    const merchant = await resolveMerchant(db, options.merchant);
    const key = await mintApiKey(db, merchant.id, options.label ?? "CLI");
    return { ...key, merchantId: merchant.id, merchantName: merchant.name };
  } finally {
    await close();
  }
}

export interface ListedMerchant {
  id: string;
  name: string;
  authUserId: string;
}

export async function listMerchantsAll(databaseUrl: string): Promise<ListedMerchant[]> {
  const { db, close } = createDb(databaseUrl);
  try {
    return await db
      .select({
        id: merchants.id,
        name: merchants.name,
        authUserId: merchants.authUserId,
      })
      .from(merchants)
      .orderBy(merchants.createdAt);
  } finally {
    await close();
  }
}

async function mintApiKey(
  db: ReturnType<typeof createDb>["db"],
  merchantId: string,
  label: string,
): Promise<CreatedKey> {
  const rawKey = `pp_live_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);

  await db.insert(apiKeys).values({
    merchantId,
    keyHash,
    prefix,
    label,
  });

  return { rawKey, prefix, label };
}

async function resolveMerchant(
  db: ReturnType<typeof createDb>["db"],
  identifier: string,
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    identifier,
  );

  if (isUuid) {
    const [row] = await db
      .select({ id: merchants.id, name: merchants.name })
      .from(merchants)
      .where(eq(merchants.id, identifier))
      .limit(1);
    if (!row) throw new Error(`No merchant found with id ${identifier}`);
    return row;
  }

  const matches = await db
    .select({ id: merchants.id, name: merchants.name })
    .from(merchants)
    .where(ilike(merchants.name, identifier))
    .limit(2);

  if (matches.length === 0) throw new Error(`No merchant found with name "${identifier}"`);
  if (matches.length > 1) {
    throw new Error(
      `Name "${identifier}" matched multiple merchants. Pass --merchant <id> instead.`,
    );
  }
  return matches[0];
}
