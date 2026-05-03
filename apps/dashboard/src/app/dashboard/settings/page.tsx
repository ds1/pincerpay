import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, apiKeys } from "@pincerpay/db";
import { eq } from "drizzle-orm";
import { MerchantForm } from "./merchant-form";
import { ApiKeysSection } from "./api-keys-section";
import { WebhookSecretSection } from "./webhook-secret-section";

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
      environment: apiKeys.environment,
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
            webhookUrlLive: merchant.webhookUrlLive,
            webhookUrlTest: merchant.webhookUrlTest,
          } : undefined}
        />
      </section>

      {merchant && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">On-Chain Status</h2>
          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${merchant.onChainRegistered ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm font-medium">
                {merchant.onChainRegistered ? "Registered on-chain" : "Not registered on-chain"}
              </span>
            </div>
            {merchant.merchantPda && (
              <p className="text-xs font-mono text-[var(--muted-foreground)]">
                PDA: {merchant.merchantPda}
              </p>
            )}
            {!merchant.onChainRegistered && (
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                On-chain registration enables audit trail and direct settlement. Contact support to register.
              </p>
            )}
          </div>
        </section>
      )}

      {merchant && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Webhook Signing Secrets</h2>
          <WebhookSecretSection
            hasSecretLive={!!merchant.webhookSecretLive}
            hasSecretTest={!!merchant.webhookSecretTest}
          />
        </section>
      )}

      {merchant && (
        <section>
          <h2 className="text-lg font-semibold mb-4">API Keys</h2>
          <ApiKeysSection keys={keys} />
        </section>
      )}
    </div>
  );
}
