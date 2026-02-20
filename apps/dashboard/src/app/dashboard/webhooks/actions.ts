"use server";

import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, webhookDeliveries } from "@pincerpay/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getAuthMerchant() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, user.id))
    .limit(1);

  return merchant ?? null;
}

export async function retryWebhook(deliveryId: string) {
  const merchant = await getAuthMerchant();
  if (!merchant) return { success: false, error: "Not authenticated" };

  const db = getDb();

  // Verify ownership
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(and(
      eq(webhookDeliveries.id, deliveryId),
      eq(webhookDeliveries.merchantId, merchant.id),
    ))
    .limit(1);

  if (!delivery) return { success: false, error: "Delivery not found" };
  if (delivery.status === "delivered") return { success: false, error: "Already delivered" };

  // Reset to retrying with immediate nextRetryAt
  await db
    .update(webhookDeliveries)
    .set({
      status: "retrying",
      nextRetryAt: new Date(),
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  revalidatePath("/dashboard/webhooks");
  return { success: true };
}
