import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, paywalls } from "@pincerpay/db";
import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import { PaywallForm, PaywallList } from "./paywall-form";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

async function getPaywalls(merchantId: string, offset: number, limit: number) {
  const db = getDb();
  return db
    .select()
    .from(paywalls)
    .where(eq(paywalls.merchantId, merchantId))
    .orderBy(desc(paywalls.createdAt))
    .offset(offset)
    .limit(limit);
}

async function getPaywallCount(merchantId: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ total: count() })
    .from(paywalls)
    .where(eq(paywalls.merchantId, merchantId));
  return result?.total ?? 0;
}

export default async function PaywallsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const merchantId = user ? await getMerchantId(user.id) : null;

  if (!merchantId) {
    return <p className="text-[var(--muted-foreground)]">Set up your merchant profile first.</p>;
  }

  const [walls, total] = await Promise.all([
    getPaywalls(merchantId, offset, limit),
    getPaywallCount(merchantId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Paywalls</h1>
        <PaywallForm />
      </div>

      {walls.length === 0 && page === 1 ? (
        <div className="p-8 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
          <p className="text-[var(--muted-foreground)] mb-2">
            No paywalls configured yet.
          </p>
          <p className="text-[var(--muted-foreground)] text-sm">
            Add one above or create them via the SDK:
          </p>
          <code className="text-sm bg-[var(--muted)] px-4 py-2 rounded-lg inline-block mt-2">
            pincerpay({"{ routes: { \"GET /api/data\": { price: \"0.01\" } } }"})
          </code>
        </div>
      ) : (
        <>
          <PaywallList paywalls={walls} />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              {page > 1 ? (
                <Link
                  href={`/dashboard/paywalls?page=${page - 1}`}
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
                  href={`/dashboard/paywalls?page=${page + 1}`}
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
