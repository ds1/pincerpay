import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, agents, transactions } from "@pincerpay/db";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
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

function formatAmount(baseUnits: string): string {
  return (Number(baseUnits) / 1_000_000).toFixed(6);
}

function formatUsdc(baseUnits: string | null): string {
  if (!baseUnits) return "Not set";
  return `${(Number(baseUnits) / 1_000_000).toFixed(2)} USDC`;
}

function statusColor(status: string) {
  if (status === "active") return "text-[var(--success)]";
  if (status === "paused") return "text-yellow-400";
  return "text-[var(--destructive)]";
}

function txStatusColor(status: string) {
  const colors: Record<string, string> = {
    confirmed: "text-[var(--success)]",
    optimistic: "text-yellow-400",
    pending: "text-[var(--muted-foreground)]",
    failed: "text-[var(--destructive)]",
  };
  return colors[status] ?? "text-[var(--muted-foreground)]";
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchantId = user ? await getMerchantId(user.id) : null;

  if (!merchantId) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const db = getDb();
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.merchantId, merchantId)))
    .limit(1);

  if (!agent) {
    notFound();
  }

  // Fetch recent transactions by this agent
  const recentTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.agentId, agent.id))
    .orderBy(desc(transactions.createdAt))
    .limit(20);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/agents"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          &larr; Agents
        </Link>
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        <span className={`text-sm font-medium ${statusColor(agent.status)}`}>
          {agent.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Solana Address</p>
          <p className="font-mono text-sm break-all">{agent.solanaAddress}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Per-Transaction Limit</p>
          <p className="text-sm font-medium">{formatUsdc(agent.maxPerTransaction)}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Daily Limit</p>
          <p className="text-sm font-medium">{formatUsdc(agent.maxPerDay)}</p>
        </div>
        {agent.smartAccountPda && (
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] mb-1">Smart Account</p>
            <p className="font-mono text-xs break-all">{agent.smartAccountPda}</p>
          </div>
        )}
        {agent.spendingLimitPda && (
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] mb-1">Spending Limit PDA</p>
            <p className="font-mono text-xs break-all">{agent.spendingLimitPda}</p>
          </div>
        )}
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Created</p>
          <p className="text-sm">{agent.createdAt.toLocaleString()}</p>
        </div>
      </div>

      <p className="text-xs text-[var(--muted-foreground)] mb-8">
        Spending limits are for your reference only and are not enforced by PincerPay. Agents manage their own spending policies.
      </p>

      <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
      {recentTxns.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No transactions from this agent yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Chain</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Gas Token</th>
                <th className="pb-3 font-medium">Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((tx) => (
                <tr key={tx.id} className="border-b border-[var(--border)]">
                  <td className="py-3">
                    <Link href={`/dashboard/transactions/${tx.id}`} className="hover:underline">
                      {tx.createdAt.toLocaleString()}
                    </Link>
                  </td>
                  <td className="py-3 text-xs">{CHAINS_BY_CAIP2[tx.chainId]?.name ?? tx.chainId}</td>
                  <td className="py-3">{formatAmount(tx.amount)} USDC</td>
                  <td className={`py-3 font-medium ${txStatusColor(tx.status)}`}>{tx.status}</td>
                  <td className="py-3">{tx.gasToken}</td>
                  <td className="py-3 font-mono text-xs truncate max-w-[120px]">{tx.txHash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
