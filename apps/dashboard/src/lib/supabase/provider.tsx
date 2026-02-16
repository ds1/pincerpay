"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const SupabaseContext = createContext<SupabaseClient | null>(null);

export function SupabaseProvider({
  url,
  publishableKey,
  children,
}: {
  url: string;
  publishableKey: string;
  children: ReactNode;
}) {
  const [supabase] = useState(() =>
    url && publishableKey ? createBrowserClient(url, publishableKey) : null,
  );
  return (
    <SupabaseContext value={supabase}>{children}</SupabaseContext>
  );
}

export function useSupabase(): SupabaseClient | null {
  return useContext(SupabaseContext);
}
