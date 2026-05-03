import { z } from "zod";
import { Hono } from "hono";
import type { Database } from "@pincerpay/db";
import { paywalls } from "@pincerpay/db";
import { eq, and, count, desc } from "drizzle-orm";
import type { AppEnv } from "../env.js";
import {
  paginationSchema,
  createPaywallSchema,
  updatePaywallSchema,
} from "./schemas.js";

export function createPaywallRoutes(db: Database) {
  const app = new Hono<AppEnv>();

  // List paywalls
  app.get("/v1/paywalls", async (c) => {
    const merchantId = c.get("merchantId");
    const environment = c.get("environment");
    const query = paginationSchema
      .extend({
        active: z.coerce.boolean().optional(),
      })
      .safeParse(c.req.query());

    if (!query.success) {
      return c.json({ error: "Invalid query parameters", details: query.error.issues }, 400);
    }

    const { limit, offset, active } = query.data;
    const conditions = [
      eq(paywalls.merchantId, merchantId),
      eq(paywalls.environment, environment),
    ];
    if (active !== undefined) {
      conditions.push(eq(paywalls.isActive, active));
    }

    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(paywalls)
        .where(where)
        .orderBy(desc(paywalls.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(paywalls)
        .where(where),
    ]);

    return c.json({ items, total, limit, offset });
  });

  // Create paywall
  app.post("/v1/paywalls", async (c) => {
    const merchantId = c.get("merchantId");
    const environment = c.get("environment");
    const body = await c.req.json();
    const parsed = createPaywallSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request body", details: parsed.error.issues }, 400);
    }

    try {
      const [created] = await db
        .insert(paywalls)
        .values({
          merchantId,
          environment,
          endpointPattern: parsed.data.endpointPattern,
          amount: parsed.data.amount,
          description: parsed.data.description ?? "",
          chains: parsed.data.chains,
        })
        .returning();

      return c.json(created, 201);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("unique")) {
        return c.json({ error: "A paywall for this endpoint already exists" }, 409);
      }
      throw err;
    }
  });

  // Update paywall (scoped to active env)
  app.put("/v1/paywalls/:id", async (c) => {
    const merchantId = c.get("merchantId");
    const environment = c.get("environment");
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = updatePaywallSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request body", details: parsed.error.issues }, 400);
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    // Remove undefined values
    for (const key of Object.keys(updates)) {
      if (updates[key] === undefined) delete updates[key];
    }

    const [updated] = await db
      .update(paywalls)
      .set(updates)
      .where(and(
        eq(paywalls.id, id),
        eq(paywalls.merchantId, merchantId),
        eq(paywalls.environment, environment),
      ))
      .returning();

    if (!updated) {
      return c.json({ error: "Paywall not found" }, 404);
    }

    return c.json(updated);
  });

  // Delete paywall (scoped to active env)
  app.delete("/v1/paywalls/:id", async (c) => {
    const merchantId = c.get("merchantId");
    const environment = c.get("environment");
    const id = c.req.param("id");

    const [deleted] = await db
      .delete(paywalls)
      .where(and(
        eq(paywalls.id, id),
        eq(paywalls.merchantId, merchantId),
        eq(paywalls.environment, environment),
      ))
      .returning({ id: paywalls.id });

    if (!deleted) {
      return c.json({ error: "Paywall not found" }, 404);
    }

    return c.body(null, 204);
  });

  return app;
}
