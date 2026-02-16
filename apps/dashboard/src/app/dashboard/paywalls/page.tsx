import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, paywalls } from "@pincerpay/db";
import { eq } from "drizzle-orm";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

async function getPaywalls(merchantId: string) {
  const db = getDb();
  return db
    .select()
    .from(paywalls)
    .where(eq(paywalls.merchantId, merchantId));
}

export default async function PaywallsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchantId = user ? await getMerchantId(user.id) : null;

  if (!merchantId) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const walls = await getPaywalls(merchantId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Paywalls</h1>
      </div>

      {walls.length === 0 ? (
        <div className="p-8 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
          <p className="text-[var(--muted-foreground)] mb-4">
            No paywalls configured yet. Paywalls are created through the merchant SDK.
          </p>
          <code className="text-sm bg-[var(--muted)] px-4 py-2 rounded-lg inline-block">
            pincerpay({"{ routes: { \"GET /api/data\": { price: \"0.01\" } } }"})
          </code>
        </div>
      ) : (
        <div className="space-y-3">
          {walls.map((wall) => (
            <div
              key={wall.id}
              className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between"
            >
              <div>
                <p className="font-mono text-sm">{wall.endpointPattern}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {wall.description}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{wall.amount} USDC</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {wall.chains?.join(", ") ?? "All chains"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
