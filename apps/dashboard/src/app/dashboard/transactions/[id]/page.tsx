import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, transactions } from "@pincerpay/db";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CHAINS_BY_CAIP2 } from "@pincerpay/core/chains";

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  mempool: "bg-blue-500/10 text-blue-500",
  optimistic: "bg-cyan-500/10 text-cyan-500",
  confirmed: "bg-green-500/10 text-green-500",
  failed: "bg-red-500/10 text-red-500",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, user.id))
    .limit(1);

  if (!merchant) notFound();

  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.merchantId, merchant.id)))
    .limit(1);

  if (!tx) notFound();

  const chain = CHAINS_BY_CAIP2[tx.chainId];
  const isSolana = tx.chainId.startsWith("solana:");

  // Solana explorer uses /tx/{sig}?cluster=devnet for devnet, no param for mainnet
  let explorerUrl: string | null = null;
  if (chain?.explorerUrl) {
    if (isSolana) {
      const clusterParam = chain.testnet ? "?cluster=devnet" : "";
      explorerUrl = `${chain.explorerUrl}/tx/${tx.txHash}${clusterParam}`;
    } else {
      explorerUrl = `${chain.explorerUrl}/tx/${tx.txHash}`;
    }
  }

  const usdc = (Number(tx.amount) / 1_000_000).toFixed(6);
  const gasToken = tx.gasToken ?? "ETH";
  // Format gas cost based on token: SOL uses 9 decimals (lamports), ETH/MATIC uses 18 (wei)
  const gasDecimals = gasToken === "SOL" ? 9 : gasToken === "USDC" ? 6 : 18;
  const gasCost = (Number(tx.gasCost) / 10 ** gasDecimals).toFixed(gasDecimals > 9 ? 8 : 6);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/transactions"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          &larr; Back to Transactions
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Transaction Detail</h1>

      <div className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-4">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGES[tx.status] ?? ""}`}>
            {tx.status}
          </span>
          {tx.optimistic && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-500/10 text-cyan-500">
              Optimistic
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Amount" value={`${usdc} USDC`} />
          <Field label="Gas Cost" value={`${gasCost} ${gasToken}`} />
          <Field label="Chain" value={chain?.name ?? tx.chainId} />
          <Field label="CAIP-2 ID" value={tx.chainId} mono />
          <Field label="From" value={tx.fromAddress} mono />
          <Field label="To" value={tx.toAddress} mono />
          {tx.slot && <Field label="Slot" value={tx.slot} mono />}
          {tx.computeUnits && <Field label="Compute Units" value={tx.computeUnits} />}
          {tx.priorityFee && <Field label="Priority Fee" value={`${tx.priorityFee} microlamports`} />}
          {tx.endpoint && <Field label="Endpoint" value={tx.endpoint} mono />}
          <Field label="Created" value={tx.createdAt.toISOString()} />
          {tx.confirmedAt && <Field label="Confirmed" value={tx.confirmedAt.toISOString()} />}
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Transaction Hash</p>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-[var(--muted)] px-3 py-1.5 rounded break-all">
              {tx.txHash}
            </code>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--primary)] hover:underline shrink-0"
              >
                View on Explorer
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className={`text-sm ${mono ? "font-mono break-all" : ""}`}>{value}</p>
    </div>
  );
}
