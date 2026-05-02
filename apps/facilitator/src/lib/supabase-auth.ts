import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) env vars must be set on the facilitator.",
    );
  }

  cached = createClient(url, key, {
    auth: {
      // Facilitator handles session management itself via cli_sessions; we never
      // want @supabase/supabase-js persisting state across requests.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

export interface SignupResult {
  /** Set when Supabase auto-confirms (project has email-confirmation disabled). */
  autoConfirmed: boolean;
  /** Set when an OTP email was sent and verifyEmailOtp must be called next. */
  emailSent: boolean;
  authUserId: string | null;
  email: string;
}

/**
 * Create a new Supabase Auth user with email + password. Supabase emails an
 * OTP token; the CLI must call verifyEmailOtp with the token next.
 *
 * Returns autoConfirmed=true only when the Supabase project is configured
 * with email confirmation disabled — in that case the user is created and
 * already verified, no second call needed.
 */
export async function signUpWithPassword(opts: {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}): Promise<SignupResult> {
  const supabase = getClient();
  const { data, error } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: {
      data: opts.metadata,
    },
  });
  if (error) throw new SupabaseAuthError(error.message, error.status ?? 400);

  // user is null if email confirmation is required and we got back only the
  // server-side confirmation tracking. Otherwise user is set.
  const autoConfirmed = !!data.user?.email_confirmed_at;
  const emailSent = !autoConfirmed;
  return {
    autoConfirmed,
    emailSent,
    authUserId: data.user?.id ?? null,
    email: opts.email,
  };
}

export interface SessionResult {
  authUserId: string;
  email: string;
  emailConfirmedAt: string | null;
  /** Supabase JWT — kept internal to the facilitator; not returned to clients. */
  accessToken: string;
}

/**
 * Verify the OTP that Supabase sent to the user's email after signup.
 * Returns a Supabase session, including the access token (which we use only
 * to extract verified user info; we do NOT pass it to CLI clients).
 */
export async function verifyEmailOtp(opts: {
  email: string;
  token: string;
}): Promise<SessionResult> {
  const supabase = getClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: opts.email,
    token: opts.token,
    type: "signup",
  });
  if (error) throw new SupabaseAuthError(error.message, error.status ?? 400);
  if (!data.user || !data.session) {
    throw new SupabaseAuthError("OTP verification did not return a session", 400);
  }
  return {
    authUserId: data.user.id,
    email: data.user.email ?? opts.email,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
    accessToken: data.session.access_token,
  };
}

/** Sign in with email + password. Returns a Supabase session. */
export async function signInWithPassword(opts: {
  email: string;
  password: string;
}): Promise<SessionResult> {
  const supabase = getClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: opts.email,
    password: opts.password,
  });
  if (error) throw new SupabaseAuthError(error.message, error.status ?? 401);
  if (!data.user || !data.session) {
    throw new SupabaseAuthError("login did not return a session", 401);
  }
  return {
    authUserId: data.user.id,
    email: data.user.email ?? opts.email,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
    accessToken: data.session.access_token,
  };
}

/**
 * Send a password recovery OTP to the email. The user gets an email with a
 * 6-digit code; the CLI then calls resetPassword with the code.
 */
export async function sendPasswordRecoveryOtp(email: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new SupabaseAuthError(error.message, error.status ?? 400);
}

/**
 * Verify a recovery OTP and set a new password atomically. The verifyOtp call
 * returns a session that we use to call updateUser; the session is discarded
 * immediately afterward (the CLI will then call /v1/onboarding/login with the
 * new password to get a pp_cli_* token).
 */
export async function resetPassword(opts: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<void> {
  const supabase = getClient();
  const verify = await supabase.auth.verifyOtp({
    email: opts.email,
    token: opts.token,
    type: "recovery",
  });
  if (verify.error) throw new SupabaseAuthError(verify.error.message, verify.error.status ?? 400);
  if (!verify.data.session) {
    throw new SupabaseAuthError("recovery did not return a session", 400);
  }

  // Use a fresh client bound to the recovery session for the password update.
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  const sessionClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${verify.data.session.access_token}` },
    },
  });
  await sessionClient.auth.setSession(verify.data.session);
  const { error } = await sessionClient.auth.updateUser({ password: opts.newPassword });
  if (error) throw new SupabaseAuthError(error.message, error.status ?? 400);
  await sessionClient.auth.signOut();
}

/**
 * Update the user's password. Requires the user to authenticate with their
 * current password first (the CLI does this transparently via /login).
 */
export async function changePassword(opts: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const session = await signInWithPassword({
    email: opts.email,
    password: opts.currentPassword,
  });

  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  const sessionClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    },
  });
  await sessionClient.auth.setSession({
    access_token: session.accessToken,
    refresh_token: "",
  });
  const { error } = await sessionClient.auth.updateUser({ password: opts.newPassword });
  if (error) throw new SupabaseAuthError(error.message, error.status ?? 400);
  await sessionClient.auth.signOut();
}

export class SupabaseAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SupabaseAuthError";
    this.status = status;
  }
}
