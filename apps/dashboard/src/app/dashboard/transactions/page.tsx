import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, transactions } from "@pincerpay/db";
import { eq, desc } from "drizzle-orm";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

async function getTransactions(merchantId: string) {
  const db = getDb();
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId))
    .orderBy(desc(transactions.createdAt))
    .limit(100);
}

function formatAmount(baseUnits: string): string {
  return (Number(baseUnits) / 1_000_000).toFixed(6);
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    confirmed: "text-[var(--success)]",
    optimistic: "text-yellow-400",
    mempool: "text-blue-400",
    pending: "text-[var(--muted-foreground)]",
    failed: "text-[var(--destructive)]",
  };
  return colors[status] ?? "text-[var(--muted-foreground)]";
}

export default async function TransactionsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchantId = user ? await getMerchantId(user.id) : null;

  if (!merchantId) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const txns = await getTransactions(merchantId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>

      {txns.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Chain</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">From</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((tx) => (
                <tr key={tx.id} className="border-b border-[var(--border)]">
                  <td className="py-3">
                    {tx.createdAt.toLocaleString()}
                  </td>
                  <td className="py-3 font-mono text-xs">{tx.chainId}</td>
                  <td className="py-3">{formatAmount(tx.amount)} USDC</td>
                  <td className="py-3 font-mono text-xs truncate max-w-[120px]">
                    {tx.fromAddress}
                  </td>
                  <td className={`py-3 font-medium ${statusBadge(tx.status)}`}>
                    {tx.status}
                    {tx.optimistic && " (opt)"}
                  </td>
                  <td className="py-3 font-mono text-xs truncate max-w-[120px]">
                    {tx.txHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
