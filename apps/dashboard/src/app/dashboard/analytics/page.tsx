import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, transactions } from "@pincerpay/db";
import { eq, sql, and, gte, desc } from "drizzle-orm";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

async function getVolumeByChain(merchantId: string) {
  const db = getDb();
  return db
    .select({
      chainId: transactions.chainId,
      volume: sql<string>`coalesce(sum(${transactions.amount}::bigint), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId))
    .groupBy(transactions.chainId);
}

async function getDailyVolume(merchantId: string) {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return db
    .select({
      date: sql<string>`date(${transactions.createdAt})`,
      volume: sql<string>`coalesce(sum(${transactions.amount}::bigint), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.merchantId, merchantId),
        gte(transactions.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(sql`date(${transactions.createdAt})`)
    .orderBy(sql`date(${transactions.createdAt})`);
}

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchantId = user ? await getMerchantId(user.id) : null;

  if (!merchantId) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const volumeByChain = await getVolumeByChain(merchantId);
  const dailyVolume = await getDailyVolume(merchantId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Volume by Chain */}
        <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Volume by Chain</h2>
          {volumeByChain.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {volumeByChain.map((row) => (
                <div key={row.chainId} className="flex justify-between items-center">
                  <span className="text-sm font-mono">{row.chainId}</span>
                  <div className="text-right">
                    <p className="font-bold">
                      ${(Number(row.volume) / 1_000_000).toFixed(2)}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {row.count} txns
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Volume (last 30 days) */}
        <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Daily Volume (30d)</h2>
          {dailyVolume.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {dailyVolume.map((row) => {
                const usdc = Number(row.volume) / 1_000_000;
                return (
                  <div key={row.date} className="flex justify-between items-center text-sm">
                    <span className="text-[var(--muted-foreground)]">{row.date}</span>
                    <span className="font-mono">${usdc.toFixed(2)} ({row.count})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
