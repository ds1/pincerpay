import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { cliSessions } from "@pincerpay/db";
import type { Database } from "@pincerpay/db";
import type { AppEnv } from "../../env.js";
import { mintCliToken } from "../../lib/tokens.js";
import {
  changePassword as supabaseChangePassword,
  resetPassword as supabaseResetPassword,
  sendPasswordRecoveryOtp,
  signInWithPassword,
  signUpWithPassword,
  SupabaseAuthError,
  verifyEmailOtp,
} from "../../lib/supabase-auth.js";
import { audit } from "../../lib/audit.js";
import { ipRateLimit } from "../../lib/rate-limit.js";
import {
  changePasswordSchema,
  loginSchema,
  recoverSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from "./schemas.js";
import { cliAuthMiddleware } from "../../middleware/cli-auth.js";

/** 30 days in milliseconds — default CLI session lifetime. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function clientIp(c: Context<AppEnv>): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    null
  );
}

function clientName(c: Context<AppEnv>, explicit?: string): string {
  if (explicit) return explicit;
  return c.req.header("user-agent") ?? "unknown";
}

interface MintForUserOptions {
  db: Database;
  authUserId: string;
  label: string;
  clientName: string;
  clientIp: string | null;
}

async function mintSessionForUser(opts: MintForUserOptions) {
  const { rawToken, hash, prefix } = mintCliToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await opts.db
    .insert(cliSessions)
    .values({
      authUserId: opts.authUserId,
      tokenHash: hash,
      prefix,
      label: opts.label,
      clientName: opts.clientName,
      clientIpFirst: opts.clientIp,
      clientIpLast: opts.clientIp,
      expiresAt,
    })
    .returning({ id: cliSessions.id });
  return {
    sessionId: row.id,
    rawToken,
    prefix,
    expiresAt,
  };
}

export function createAuthRoute(db: Database) {
  const app = new Hono<AppEnv>();

  // Public endpoints get tighter IP rate limits than the global facilitator rate.
  const stricter = ipRateLimit({ limit: 10, windowMs: 60_000, prefix: "onboarding-auth" });
  app.use("/v1/onboarding/auth/*", stricter);

  // ── Signup ───────────────────────────────────────────────────────────────

  app.post("/v1/onboarding/auth/signup", async (c) => {
    const logger = c.get("logger");
    const body = await c.req.json().catch(() => ({}));
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_body", details: parsed.error.issues },
        400,
      );
    }

    const ip = clientIp(c);
    const cName = clientName(c, parsed.data.clientName);

    try {
      const result = await signUpWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
        metadata: parsed.data.metadata,
      });

      await audit(db, {
        authUserId: result.authUserId,
        eventType: "signup.completed",
        metadata: { email: parsed.data.email, autoConfirmed: result.autoConfirmed },
        clientIp: ip,
        clientName: cName,
      }, logger);

      // If auto-confirmed (email confirmation disabled), mint a session immediately.
      if (result.autoConfirmed && result.authUserId) {
        const session = await mintSessionForUser({
          db,
          authUserId: result.authUserId,
          label: parsed.data.metadata?.label as string ?? "CLI",
          clientName: cName,
          clientIp: ip,
        });
        await audit(db, {
          authUserId: result.authUserId,
          eventType: "cli_session.minted",
          metadata: { sessionId: session.sessionId, prefix: session.prefix },
          clientIp: ip,
          clientName: cName,
        }, logger);
        return c.json({
          status: "signed_up",
          autoConfirmed: true,
          accessToken: session.rawToken,
          tokenType: "Bearer",
          expiresAt: session.expiresAt.toISOString(),
          prefix: session.prefix,
          authUserId: result.authUserId,
        });
      }

      return c.json({
        status: "verification_email_sent",
        autoConfirmed: false,
        email: parsed.data.email,
        message: "Check your email for a verification code, then call /v1/onboarding/auth/verify-email.",
      });
    } catch (err) {
      const status = err instanceof SupabaseAuthError ? err.status : 500;
      const message = err instanceof Error ? err.message : "signup_failed";
      logger.warn({ msg: "signup_failed", error: message, status });
      await audit(db, {
        eventType: "signup.failed",
        metadata: { email: parsed.data.email, error: message },
        clientIp: ip,
        clientName: cName,
      }, logger);
      return c.json({ error: "signup_failed", message }, status >= 400 && status < 500 ? (status as 400 | 401 | 403 | 409) : 500);
    }
  });

  // ── Verify email + mint session ──────────────────────────────────────────

  app.post("/v1/onboarding/auth/verify-email", async (c) => {
    const logger = c.get("logger");
    const body = await c.req.json().catch(() => ({}));
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const ip = clientIp(c);
    const cName = clientName(c, parsed.data.clientName);

    try {
      const session = await verifyEmailOtp({
        email: parsed.data.email,
        token: parsed.data.token,
      });

      const minted = await mintSessionForUser({
        db,
        authUserId: session.authUserId,
        label: parsed.data.sessionLabel ?? "CLI",
        clientName: cName,
        clientIp: ip,
      });

      await audit(db, {
        authUserId: session.authUserId,
        eventType: "email.verified",
        metadata: { email: session.email },
        clientIp: ip,
        clientName: cName,
      }, logger);
      await audit(db, {
        authUserId: session.authUserId,
        eventType: "cli_session.minted",
        metadata: { sessionId: minted.sessionId, prefix: minted.prefix },
        clientIp: ip,
        clientName: cName,
      }, logger);

      return c.json({
        status: "verified",
        accessToken: minted.rawToken,
        tokenType: "Bearer",
        expiresAt: minted.expiresAt.toISOString(),
        prefix: minted.prefix,
        authUserId: session.authUserId,
        email: session.email,
      });
    } catch (err) {
      const status = err instanceof SupabaseAuthError ? err.status : 500;
      const message = err instanceof Error ? err.message : "verify_failed";
      logger.warn({ msg: "verify_email_failed", error: message, status });
      return c.json({ error: "verify_failed", message }, status as 400);
    }
  });

  // ── Login ────────────────────────────────────────────────────────────────

  app.post("/v1/onboarding/auth/login", async (c) => {
    const logger = c.get("logger");
    const body = await c.req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const ip = clientIp(c);
    const cName = clientName(c, parsed.data.clientName);

    try {
      const session = await signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (!session.emailConfirmedAt) {
        return c.json(
          {
            error: "email_not_verified",
            message: "Verify your email before logging in. Use /v1/onboarding/auth/verify-email with the OTP from your inbox.",
          },
          403,
        );
      }

      const minted = await mintSessionForUser({
        db,
        authUserId: session.authUserId,
        label: parsed.data.sessionLabel ?? "CLI",
        clientName: cName,
        clientIp: ip,
      });

      await audit(db, {
        authUserId: session.authUserId,
        eventType: "login.completed",
        metadata: { email: session.email },
        clientIp: ip,
        clientName: cName,
      }, logger);
      await audit(db, {
        authUserId: session.authUserId,
        eventType: "cli_session.minted",
        metadata: { sessionId: minted.sessionId, prefix: minted.prefix },
        clientIp: ip,
        clientName: cName,
      }, logger);

      return c.json({
        status: "logged_in",
        accessToken: minted.rawToken,
        tokenType: "Bearer",
        expiresAt: minted.expiresAt.toISOString(),
        prefix: minted.prefix,
        authUserId: session.authUserId,
        email: session.email,
      });
    } catch (err) {
      const status = err instanceof SupabaseAuthError ? err.status : 500;
      const message = err instanceof Error ? err.message : "login_failed";
      logger.warn({ msg: "login_failed", error: message, status });
      await audit(db, {
        eventType: "login.failed",
        metadata: { email: parsed.data.email, error: message },
        clientIp: ip,
        clientName: cName,
      }, logger);
      return c.json({ error: "login_failed", message }, status as 401);
    }
  });

  // ── Password recovery (send OTP) ─────────────────────────────────────────

  app.post("/v1/onboarding/auth/recover", async (c) => {
    const logger = c.get("logger");
    const body = await c.req.json().catch(() => ({}));
    const parsed = recoverSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const ip = clientIp(c);
    const cName = clientName(c);

    // Always return success regardless of whether email exists, to prevent
    // user-enumeration. Supabase rate-limits OTP sending internally.
    try {
      await sendPasswordRecoveryOtp(parsed.data.email);
    } catch (err) {
      logger.warn({
        msg: "recovery_otp_send_failed",
        email: parsed.data.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await audit(db, {
      eventType: "password.recovery_sent",
      metadata: { email: parsed.data.email },
      clientIp: ip,
      clientName: cName,
    }, logger);

    return c.json({
      status: "recovery_email_sent",
      message: "If an account exists for that email, a recovery code was sent.",
    });
  });

  // ── Reset password (verify recovery OTP) ─────────────────────────────────

  app.post("/v1/onboarding/auth/reset-password", async (c) => {
    const logger = c.get("logger");
    const body = await c.req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const ip = clientIp(c);
    const cName = clientName(c);

    try {
      await supabaseResetPassword({
        email: parsed.data.email,
        token: parsed.data.token,
        newPassword: parsed.data.newPassword,
      });

      await audit(db, {
        eventType: "password.reset",
        metadata: { email: parsed.data.email },
        clientIp: ip,
        clientName: cName,
      }, logger);

      return c.json({
        status: "password_reset",
        message: "Password reset. Call /v1/onboarding/auth/login to get a new CLI token.",
      });
    } catch (err) {
      const status = err instanceof SupabaseAuthError ? err.status : 500;
      const message = err instanceof Error ? err.message : "reset_failed";
      logger.warn({ msg: "password_reset_failed", error: message, status });
      return c.json({ error: "reset_failed", message }, status as 400);
    }
  });

  // ── Change password (authenticated user changes own password) ───────────

  app.post("/v1/onboarding/auth/change-password", cliAuthMiddleware(db), async (c) => {
    const logger = c.get("logger");
    const authUserId = c.get("authUserId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
    }

    const ip = clientIp(c);
    const cName = clientName(c);

    try {
      await supabaseChangePassword({
        email: parsed.data.email,
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });

      // Revoke all OTHER sessions for this user (defense in depth: if the old
      // password was compromised, kill all sessions except the one making the
      // change request).
      const cliSessionId = c.get("cliSessionId");
      await db
        .update(cliSessions)
        .set({ revokedAt: new Date(), revokedReason: "user" })
        .where(eq(cliSessions.authUserId, authUserId));
      await db
        .update(cliSessions)
        .set({ revokedAt: null, revokedReason: null })
        .where(eq(cliSessions.id, cliSessionId));

      await audit(db, {
        authUserId,
        eventType: "password.changed",
        metadata: { email: parsed.data.email, otherSessionsRevoked: true },
        clientIp: ip,
        clientName: cName,
      }, logger);

      return c.json({ status: "password_changed", otherSessionsRevoked: true });
    } catch (err) {
      const status = err instanceof SupabaseAuthError ? err.status : 500;
      const message = err instanceof Error ? err.message : "change_failed";
      logger.warn({ msg: "password_change_failed", error: message, status });
      return c.json({ error: "change_failed", message }, status as 400);
    }
  });

  return app;
}
