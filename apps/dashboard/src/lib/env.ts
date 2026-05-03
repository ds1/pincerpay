import { cookies } from "next/headers";
import type { Environment } from "@pincerpay/db";

export const ENV_COOKIE = "pp-env";
const VALID: readonly Environment[] = ["live", "test"];

function parse(value: string | undefined | null): Environment {
  return value === "test" ? "test" : "live";
}

/**
 * Resolve the dashboard's current environment from the URL `?env=` param when
 * present, otherwise the `pp-env` cookie, otherwise default to "live".
 *
 * Used by every server component that lists env-scoped resources (transactions,
 * paywalls, webhooks, api keys) so the global header toggle controls all views
 * coherently.
 */
export async function getEnvFromRequest(searchParams?: { env?: string }): Promise<Environment> {
  if (searchParams?.env && VALID.includes(searchParams.env as Environment)) {
    return parse(searchParams.env);
  }
  const c = await cookies();
  const cookieValue = c.get(ENV_COOKIE)?.value;
  return parse(cookieValue);
}
