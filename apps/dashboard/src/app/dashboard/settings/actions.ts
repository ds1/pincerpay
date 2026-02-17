"use server";

import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, apiKeys } from "@pincerpay/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { API_KEY_PREFIX_LENGTH } from "@pincerpay/core";

export async function saveMerchantProfile(formData: FormData) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const db = getDb();
  const name = formData.get("name") as string;
  const walletAddress = formData.get("walletAddress") as string;
  const chains = formData.getAll("chains") as string[];
  const webhookUrl = (formData.get("webhookUrl") as string) || null;

  // Validate wallet address (EVM or Solana)
  if (walletAddress) {
    const isEvm = /^0x[0-9a-fA-F]{40}$/.test(walletAddress);
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress);
    if (!isEvm && !isSolana) {
      return { success: false, error: "Invalid wallet address. Must be an EVM address (0x...) or Solana address (base58, 32-44 chars)." };
    }
  }

  // Check if merchant exists
  const [existing] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, user.id))
    .limit(1);

  if (existing) {
    await db
      .update(merchants)
      .set({
        name,
        walletAddress,
        supportedChains: chains,
        webhookUrl,
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, existing.id));
  } else {
    await db.insert(merchants).values({
      name,
      walletAddress,
      supportedChains: chains,
      webhookUrl,
      authUserId: user.id,
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createApiKey(label: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, user.id))
    .limit(1);

  if (!merchant) return { success: false, error: "No merchant profile" };

  // Generate API key: pp_live_ + 32 random hex chars
  const rawKey = `pp_live_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const prefix = rawKey.slice(0, API_KEY_PREFIX_LENGTH);

  await db.insert(apiKeys).values({
    merchantId: merchant.id,
    keyHash,
    prefix,
    label,
  });

  revalidatePath("/dashboard/settings");
  return { success: true, key: rawKey };
}

export async function revokeApiKey(keyId: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const db = getDb();

  // Verify ownership
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, user.id))
    .limit(1);

  if (!merchant) return { success: false, error: "No merchant profile" };

  await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.merchantId, merchant.id)));

  revalidatePath("/dashboard/settings");
  return { success: true };
}
