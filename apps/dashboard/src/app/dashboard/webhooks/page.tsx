import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, webhookDeliveries } from "@pincerpay/db";
import { eq, desc, count, and } from "drizzle-orm";
import Link from "next/link";
import { RetryButton } from "./retry-button";

export const dynamic = "force-dynamic";

async function getMerchant(authUserId: string) {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id, webhookUrl: merchants.webhookUrl })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant ?? null;
}

async function getDeliveries(merchantId: string, offset: number, limit: number) {
  const db = getDb();
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.merchantId, merchantId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .offset(offset)
    .limit(limit);
}

async function getDeliveryStats(merchantId: string) {
  const db = getDb();
  const statuses = ["delivered", "failed", "retrying", "pending"] as const;
  const results: Record<string, number> = {};

  for (const status of statuses) {
    const [result] = await db
      .select({ total: count() })
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.merchantId, merchantId), eq(webhookDeliveries.status, status)));
    results[status] = result?.total ?? 0;
  }

  return results;
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
    delivered: "text-[var(--success)]",
    failed: "text-[var(--destructive)]",
    retrying: "text-yellow-400",
    pending: "text-[var(--muted-foreground)]",
  };
  return colors[status] ?? "text-[var(--muted-foreground)]";
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 25;
  const offset = (page - 1) * limit;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchant = user ? await getMerchant(user.id) : null;

  if (!merchant) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const [deliveries, stats] = await Promise.all([
    getDeliveries(merchant.id, offset, limit),
    getDeliveryStats(merchant.id),
  ]);

  const totalDeliveries = Object.values(stats).reduce((a, b) => a + b, 0);
  const totalPages = Math.max(1, Math.ceil(totalDeliveries / limit));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <Link
          href="/dashboard/settings"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          Configure URL
        </Link>
      </div>

      {/* Current webhook URL */}
      <div className="mb-6 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <div className="text-sm text-[var(--muted-foreground)] mb-1">Webhook URL</div>
        {merchant.webhookUrl ? (
          <code className="text-sm font-mono">{merchant.webhookUrl}</code>
        ) : (
          <span className="text-sm text-[var(--muted-foreground)]">
            Not configured.{" "}
            <Link href="/dashboard/settings" className="text-[var(--primary)] hover:underline">
              Set one in Settings
            </Link>
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {(["delivered", "retrying", "pending", "failed"] as const).map((status) => (
          <div key={status} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <div className={`text-lg font-bold ${statusColor(status)}`}>{stats[status] ?? 0}</div>
            <div className="text-xs text-[var(--muted-foreground)] capitalize">{status}</div>
          </div>
        ))}
      </div>

      {/* Delivery history */}
      {deliveries.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No webhook deliveries yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Event</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Attempts</th>
                  <th className="pb-3 font-medium">Error</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border)]">
                    <td className="py-3 text-xs">{d.createdAt.toLocaleString()}</td>
                    <td className="py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        {d.event}
                      </span>
                    </td>
                    <td className={`py-3 font-medium ${statusColor(d.status)}`}>{d.status}</td>
                    <td className="py-3 text-xs font-mono">{d.statusCode ?? "-"}</td>
                    <td className="py-3 text-xs">{d.attempts}/{d.maxAttempts}</td>
                    <td className="py-3 text-xs text-[var(--destructive)] truncate max-w-[200px]">
                      {d.lastError ?? ""}
                    </td>
                    <td className="py-3">
                      {(d.status === "failed" || d.status === "retrying") && (
                        <RetryButton deliveryId={d.id} />
                      )}
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
                  href={`/dashboard/webhooks?page=${page - 1}`}
                  className="px-3 py-1 rounded bg-[var(--muted)] hover:bg-[var(--accent)] text-sm"
                >
                  Prev
                </Link>
              ) : (
                <span className="px-3 py-1 rounded text-sm text-[var(--muted-foreground)] opacity-50">Prev</span>
              )}
              <span className="text-sm text-[var(--muted-foreground)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/dashboard/webhooks?page=${page + 1}`}
                  className="px-3 py-1 rounded bg-[var(--muted)] hover:bg-[var(--accent)] text-sm"
                >
                  Next
                </Link>
              ) : (
                <span className="px-3 py-1 rounded text-sm text-[var(--muted-foreground)] opacity-50">Next</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
