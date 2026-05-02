import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { merchants } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../../env.js";
import { audit } from "../../lib/audit.js";
import { bootstrapMerchantSchema, patchMerchantSchema } from "./schemas.js";

function pickPrimaryWallet(
  walletAddresses: Record<string, string> | undefined,
  fallback: string | undefined,
): string | null {
  if (walletAddresses && Object.keys(walletAddresses).length > 0) {
    return walletAddresses.solana ?? Object.values(walletAddresses)[0] ?? null;
  }
  return fallback ?? null;
}

function clientIp(c: Context<AppEnv>): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
}

export function createMerchantOnboardingRoute(db: Database) {
  const app = new Hono<AppEnv>();

  // ── Bootstrap merchant (find-or-create, idempotent on auth_user_id) ──────

  app.post("/v1/onboarding/merchant/bootstrap", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = bootstrapMerchantSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const primary = pickPrimaryWallet(
      parsed.data.walletAddresses,
      parsed.data.walletAddress,
    );
    if (!primary) {
      return c.json(
        {
          error: "missing_wallet_address",
          message: "Provide either walletAddress or walletAddresses with at least one entry.",
        },
        400,
      );
    }

    const ip = clientIp(c);
    const cName = c.req.header("user-agent") ?? "unknown";

    // Find existing first
    const [existing] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.authUserId, authUserId))
      .limit(1);

    if (existing) {
      return c.json({
        merchantId: existing.id,
        name: existing.name,
        walletAddress: existing.walletAddress,
        supportedChains: existing.supportedChains,
        webhookUrl: existing.webhookUrl,
        isNew: false,
      });
    }

    // Create — race-safe via unique constraint on auth_user_id. If a parallel
    // request already inserted, the catch falls through to the find again.
    try {
      const [created] = await db
        .insert(merchants)
        .values({
          name: parsed.data.name,
          walletAddress: primary,
          supportedChains: parsed.data.supportedChains,
          webhookUrl: parsed.data.webhookUrl ?? null,
          authUserId,
        })
        .returning({
          id: merchants.id,
          name: merchants.name,
          walletAddress: merchants.walletAddress,
          supportedChains: merchants.supportedChains,
          webhookUrl: merchants.webhookUrl,
        });

      await audit(db, {
        authUserId,
        merchantId: created.id,
        eventType: "merchant.created",
        metadata: {
          name: created.name,
          walletAddresses: parsed.data.walletAddresses ?? { primary },
          supportedChains: created.supportedChains,
        },
        clientIp: ip,
        clientName: cName,
      }, logger);

      return c.json({
        merchantId: created.id,
        name: created.name,
        walletAddress: created.walletAddress,
        supportedChains: created.supportedChains,
        webhookUrl: created.webhookUrl,
        isNew: true,
      });
    } catch (err) {
      // Race: another request created the merchant between our find and insert.
      const [retry] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.authUserId, authUserId))
        .limit(1);
      if (retry) {
        return c.json({
          merchantId: retry.id,
          name: retry.name,
          walletAddress: retry.walletAddress,
          supportedChains: retry.supportedChains,
          webhookUrl: retry.webhookUrl,
          isNew: false,
        });
      }
      logger.error({
        msg: "merchant_bootstrap_failed",
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "bootstrap_failed" }, 500);
    }
  });

  // ── Get current merchant ─────────────────────────────────────────────────

  app.get("/v1/onboarding/merchant", async (c) => {
    const authUserId = c.get("authUserId");
    const [row] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.authUserId, authUserId))
      .limit(1);
    if (!row) return c.json({ error: "merchant_not_found" }, 404);
    return c.json({
      merchantId: row.id,
      name: row.name,
      walletAddress: row.walletAddress,
      supportedChains: row.supportedChains,
      webhookUrl: row.webhookUrl,
      onChainRegistered: row.onChainRegistered,
      createdAt: row.createdAt.toISOString(),
    });
  });

  // ── Patch merchant ───────────────────────────────────────────────────────

  app.patch("/v1/onboarding/merchant", async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = patchMerchantSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const [existing] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.authUserId, authUserId))
      .limit(1);
    if (!existing) return c.json({ error: "merchant_not_found" }, 404);

    const updates: Partial<typeof merchants.$inferInsert> = {};
    let walletChanged = false;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.supportedChains !== undefined) {
      updates.supportedChains = parsed.data.supportedChains;
    }
    if (parsed.data.webhookUrl !== undefined) {
      updates.webhookUrl = parsed.data.webhookUrl;
    }
    const newWallet = pickPrimaryWallet(
      parsed.data.walletAddresses,
      parsed.data.walletAddress,
    );
    if (newWallet && newWallet !== existing.walletAddress) {
      updates.walletAddress = newWallet;
      walletChanged = true;
    }
    if (Object.keys(updates).length === 0) {
      return c.json({ status: "no_change", merchantId: existing.id });
    }
    updates.updatedAt = new Date();

    await db
      .update(merchants)
      .set(updates)
      .where(eq(merchants.id, existing.id));

    const ip = clientIp(c);
    const cName = c.req.header("user-agent") ?? "unknown";

    await audit(db, {
      authUserId,
      merchantId: existing.id,
      eventType: walletChanged ? "wallet.changed" : "merchant.updated",
      metadata: {
        ...updates,
        ...(walletChanged
          ? { oldWallet: existing.walletAddress, newWallet: updates.walletAddress }
          : {}),
      },
      clientIp: ip,
      clientName: cName,
    }, logger);

    if (walletChanged) {
      logger.info({
        msg: "wallet_changed_send_email_TODO",
        merchantId: existing.id,
        oldWallet: existing.walletAddress,
        newWallet: updates.walletAddress,
        hint: "Email notification gate is a soft TODO; audit log captures the change for now.",
      });
    }

    return c.json({ status: "updated", merchantId: existing.id, walletChanged });
  });

  return app;
}
