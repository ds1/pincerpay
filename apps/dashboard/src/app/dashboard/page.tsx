import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, transactions } from "@pincerpay/db";
import { eq, sql, and, gte } from "drizzle-orm";

async function getMerchant(authUserId: string) {
  const db = getDb();
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant;
}

async function getStats(merchantId: string) {
  const db = getDb();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      totalTxns: sql<number>`count(*)`,
      totalVolume: sql<string>`coalesce(sum(${transactions.amount}::bigint), 0)`,
      confirmedTxns: sql<number>`count(*) filter (where ${transactions.status} = 'confirmed')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.merchantId, merchantId),
        gte(transactions.createdAt, thirtyDaysAgo),
      ),
    );

  return stats;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchant = user ? await getMerchant(user.id) : null;

  if (!merchant) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Welcome to PincerPay</h1>
        <p className="text-[var(--muted-foreground)] mb-6">
          Complete your merchant profile to start accepting payments.
        </p>
        <a
          href="/dashboard/settings"
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90"
        >
          Set Up Profile
        </a>
      </div>
    );
  }

  const stats = await getStats(merchant.id);

  // Convert volume from base units to USDC
  const volumeUsdc = stats
    ? (Number(stats.totalVolume) / 1_000_000).toFixed(2)
    : "0.00";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">30d Volume</p>
          <p className="text-3xl font-bold mt-1">${volumeUsdc}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">USDC</p>
        </div>
        <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">Transactions</p>
          <p className="text-3xl font-bold mt-1">{stats?.totalTxns ?? 0}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Last 30 days</p>
        </div>
        <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">Confirmed</p>
          <p className="text-3xl font-bold mt-1">{stats?.confirmedTxns ?? 0}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {stats && stats.totalTxns > 0
              ? `${((stats.confirmedTxns / stats.totalTxns) * 100).toFixed(0)}% rate`
              : "No transactions yet"}
          </p>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <h2 className="text-lg font-semibold mb-2">Merchant Profile</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-[var(--muted-foreground)]">Name</dt>
          <dd>{merchant.name}</dd>
          <dt className="text-[var(--muted-foreground)]">Wallet</dt>
          <dd className="font-mono truncate">{merchant.walletAddress}</dd>
          <dt className="text-[var(--muted-foreground)]">Chains</dt>
          <dd>{merchant.supportedChains.join(", ") || "None configured"}</dd>
        </dl>
      </div>
    </div>
  );
}
