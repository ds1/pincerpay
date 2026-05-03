"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ENV_COOKIE } from "@/lib/env";
import type { Environment } from "@pincerpay/db";

export async function setEnvironment(value: Environment) {
  const c = await cookies();
  c.set(ENV_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/dashboard", "layout");
}
