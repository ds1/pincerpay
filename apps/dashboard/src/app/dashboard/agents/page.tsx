import { getDb } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { merchants, agents } from "@pincerpay/db";
import { eq, desc, count } from "drizzle-orm";
import Link from "next/link";
import { AgentList } from "./agent-form";

async function getMerchantId(authUserId: string): Promise<string | null> {
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.authUserId, authUserId))
    .limit(1);
  return merchant?.id ?? null;
}

async function getAgents(merchantId: string, offset: number, limit: number) {
  const db = getDb();
  return db
    .select()
    .from(agents)
    .where(eq(agents.merchantId, merchantId))
    .orderBy(desc(agents.createdAt))
    .offset(offset)
    .limit(limit);
}

async function getAgentCount(merchantId: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ total: count() })
    .from(agents)
    .where(eq(agents.merchantId, merchantId));
  return result?.total ?? 0;
}

export default async function AgentsPage({
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

  const [agentList, total] = await Promise.all([
    getAgents(merchantId, offset, limit),
    getAgentCount(merchantId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Agents</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Agents appear here automatically when they first pay your API. Click an agent&apos;s name to rename it. Any agent can pay your endpoints &mdash; no registration required.
        </p>
      </div>

      {agentList.length === 0 && page === 1 ? (
        <div className="p-8 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center">
          <p className="text-[var(--muted-foreground)] mb-2">
            No agents have paid your API yet.
          </p>
          <p className="text-[var(--muted-foreground)] text-sm">
            Once an agent makes its first payment through any of your paywalls, it will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <AgentList agents={agentList} />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              {page > 1 ? (
                <Link
                  href={`/dashboard/agents?page=${page - 1}`}
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
                  href={`/dashboard/agents?page=${page + 1}`}
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
