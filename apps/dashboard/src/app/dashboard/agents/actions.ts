"use server";

import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, agents } from "@pincerpay/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

export async function updateAgent(agentId: string, formData: FormData) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const merchantId = await getMerchantId(user.id);
  if (!merchantId) return { success: false, error: "No merchant profile" };

  const name = formData.get("name") as string;
  const maxPerTransaction = (formData.get("maxPerTransaction") as string) || null;
  const maxPerDay = (formData.get("maxPerDay") as string) || null;
  const status = formData.get("status") as string;

  const db = getDb();
  await db
    .update(agents)
    .set({
      name: name || undefined,
      maxPerTransaction,
      maxPerDay,
      status: status || undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, agentId), eq(agents.merchantId, merchantId)));

  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${agentId}`);
  return { success: true };
}

export async function deleteAgent(agentId: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const merchantId = await getMerchantId(user.id);
  if (!merchantId) return { success: false, error: "No merchant profile" };

  const db = getDb();
  await db
    .delete(agents)
    .where(and(eq(agents.id, agentId), eq(agents.merchantId, merchantId)));

  revalidatePath("/dashboard/agents");
  return { success: true };
}
