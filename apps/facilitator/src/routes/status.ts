import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import { transactions } from "@pincerpay/db";
import { eq } from "drizzle-orm";

export function createStatusRoute(db: Database) {
  const app = new Hono();

  app.get("/v1/status/:txHash", async (c) => {
    const txHash = c.req.param("txHash");

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.txHash, txHash))
      .limit(1);

    if (!tx) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    return c.json({
      id: tx.id,
      chainId: tx.chainId,
      txHash: tx.txHash,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      amount: tx.amount,
      gasCost: tx.gasCost,
      status: tx.status,
      optimistic: tx.optimistic,
      createdAt: tx.createdAt,
      confirmedAt: tx.confirmedAt,
    });
  });

  return app;
}
