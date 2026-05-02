import { z } from "zod";

const email = z.string().email();
const password = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(128, "password must be at most 128 characters");
const otp = z
  .string()
  .min(6)
  .max(10)
  .regex(/^[0-9A-Za-z-]+$/, "invalid OTP format");
const merchantName = z.string().min(1).max(100);
const walletAddress = z.string().min(1).max(100);
const apiKeyLabel = z.string().min(1).max(50);
const sessionLabel = z.string().min(1).max(50);
const clientName = z.string().min(1).max(100).optional();

// ─── Auth ───

export const signupSchema = z.object({
  email,
  password,
  /** Optional Supabase user metadata. Not required. */
  metadata: z.record(z.string(), z.unknown()).optional(),
  clientName,
});

export const verifyEmailSchema = z.object({
  email,
  token: otp,
  /** Label for the CLI session that gets minted on successful verification. */
  sessionLabel: sessionLabel.optional(),
  clientName,
});

export const loginSchema = z.object({
  email,
  password,
  sessionLabel: sessionLabel.optional(),
  clientName,
});

export const recoverSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  token: otp,
  newPassword: password,
});

export const changePasswordSchema = z.object({
  email,
  currentPassword: password,
  newPassword: password,
});

// ─── Merchant ───

export const bootstrapMerchantSchema = z.object({
  name: merchantName,
  /** Per-chain receiving wallets keyed by shorthand: { solana, polygon, ... }. */
  walletAddresses: z.record(z.string().min(1), walletAddress).optional(),
  /** Single-chain fallback. Required if walletAddresses omitted. */
  walletAddress: walletAddress.optional(),
  supportedChains: z.array(z.string().min(1)).default(["solana", "polygon"]),
  webhookUrl: z.string().url().optional(),
});

export const patchMerchantSchema = z.object({
  name: merchantName.optional(),
  walletAddress: walletAddress.optional(),
  walletAddresses: z.record(z.string().min(1), walletAddress).optional(),
  supportedChains: z.array(z.string().min(1)).optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

// ─── API keys ───

export const createApiKeySchema = z.object({
  label: apiKeyLabel.default("default"),
  /** Optional ISO timestamp. If omitted, key never expires. */
  expiresAt: z.string().datetime().optional(),
});

// ─── Sessions ───

export const sessionIdParamSchema = z.object({
  id: z.string().uuid(),
});
