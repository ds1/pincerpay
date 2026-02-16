import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, apiKeys } from "@pincerpay/db";
import { eq } from "drizzle-orm";
import { MerchantForm } from "./merchant-form";
import { ApiKeysSection } from "./api-keys-section";

async function getMerchant(authUserId: string) {
  const db = getDb();
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant;
}

async function getApiKeys(merchantId: string) {
  const db = getDb();
  return db
    .select({
      id: apiKeys.id,
      prefix: apiKeys.prefix,
      label: apiKeys.label,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.merchantId, merchantId));
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const merchant = await getMerchant(user.id);
  const keys = merchant ? await getApiKeys(merchant.id) : [];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Merchant Profile</h2>
        <MerchantForm
          merchant={merchant ? {
            name: merchant.name,
            walletAddress: merchant.walletAddress,
            supportedChains: merchant.supportedChains,
            webhookUrl: merchant.webhookUrl,
          } : undefined}
        />
      </section>

      {merchant && (
        <section>
          <h2 className="text-lg font-semibold mb-4">API Keys</h2>
          <ApiKeysSection keys={keys} />
        </section>
      )}
    </div>
  );
}
