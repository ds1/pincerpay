import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, transactions } from "@pincerpay/db";
import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import { CHAINS_BY_CAIP2 } from "@pincerpay/core/chains";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

async function getTransactions(merchantId: string, offset: number, limit: number) {
  const db = getDb();
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId))
    .orderBy(desc(transactions.createdAt))
    .offset(offset)
    .limit(limit);
}

async function getTransactionCount(merchantId: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId));
  return result?.total ?? 0;
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

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(params.limit ?? "50", 10)));
  const offset = (page - 1) * limit;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchantId = user ? await getMerchantId(user.id) : null;

  if (!merchantId) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const [txns, total] = await Promise.all([
    getTransactions(merchantId, offset, limit),
    getTransactionCount(merchantId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <span className="text-sm text-[var(--muted-foreground)]">{total} total</span>
      </div>

      {txns.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No transactions yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Chain</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">From</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((tx) => (
                  <tr key={tx.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                    <td className="py-3">
                      <Link href={`/dashboard/transactions/${tx.id}`} className="hover:underline">
                        {tx.createdAt.toLocaleString()}
                      </Link>
                    </td>
                    <td className="py-3 text-xs">{CHAINS_BY_CAIP2[tx.chainId]?.name ?? tx.chainId}</td>
                    <td className="py-3">{formatAmount(tx.amount)} USDC</td>
                    <td className="py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        tx.settlementType === "direct"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {tx.settlementType ?? "x402"}
                      </span>
                    </td>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              {page > 1 ? (
                <Link
                  href={`/dashboard/transactions?page=${page - 1}&limit=${limit}`}
                  className="px-3 py-1 rounded bg-[var(--muted)] hover:bg-[var(--accent)] text-sm"
                >
                  Prev
                </Link>
              ) : (
                <span className="px-3 py-1 rounded text-sm text-[var(--muted-foreground)] opacity-50">
                  Prev
                </span>
              )}

              <span className="text-sm text-[var(--muted-foreground)]">
                Page {page} of {totalPages}
              </span>

              {page < totalPages ? (
                <Link
                  href={`/dashboard/transactions?page=${page + 1}&limit=${limit}`}
                  className="px-3 py-1 rounded bg-[var(--muted)] hover:bg-[var(--accent)] text-sm"
                >
                  Next
                </Link>
              ) : (
                <span className="px-3 py-1 rounded text-sm text-[var(--muted-foreground)] opacity-50">
                  Next
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
