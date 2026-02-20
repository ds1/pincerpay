import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const merchantId = await getMerchantId(user.id);
  if (!merchantId) {
    return NextResponse.json({ error: "No merchant profile" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(10000, Math.max(1, parseInt(limitParam, 10))) : 10000;

  const db = getDb();
  const rows = await db
    .select({
      id: transactions.id,
      chainId: transactions.chainId,
      txHash: transactions.txHash,
      fromAddress: transactions.fromAddress,
      toAddress: transactions.toAddress,
      amount: transactions.amount,
      gasCost: transactions.gasCost,
      gasToken: transactions.gasToken,
      status: transactions.status,
      settlementType: transactions.settlementType,
      createdAt: transactions.createdAt,
      confirmedAt: transactions.confirmedAt,
    })
    .from(transactions)
    .where(eq(transactions.merchantId, merchantId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const json = rows.map((r) => ({
      ...r,
      amountUsdc: (Number(r.amount) / 1_000_000).toFixed(6),
      createdAt: r.createdAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
    }));

    return new NextResponse(JSON.stringify(json, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pincerpay-transactions-${timestamp}.json"`,
      },
    });
  }

  // CSV format
  const header = "id,chain,tx_hash,from,to,amount_base_units,amount_usdc,gas_cost,gas_token,status,type,created_at,confirmed_at";
  const csvRows = rows.map((r) => {
    const amountUsdc = (Number(r.amount) / 1_000_000).toFixed(6);
    return [
      r.id,
      r.chainId,
      r.txHash,
      r.fromAddress,
      r.toAddress,
      r.amount,
      amountUsdc,
      r.gasCost ?? "",
      r.gasToken ?? "",
      r.status,
      r.settlementType ?? "x402",
      r.createdAt.toISOString(),
      r.confirmedAt?.toISOString() ?? "",
    ].join(",");
  });

  const csv = [header, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pincerpay-transactions-${timestamp}.csv"`,
    },
  });
}
