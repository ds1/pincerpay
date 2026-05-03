import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getEnvFromRequest } from "@/lib/env";
import { Sidebar } from "./sidebar";
import { EnvToggle } from "./env-toggle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.id === process.env.ADMIN_USER_ID;
  const environment = await getEnvFromRequest();
  const isTest = environment === "test";

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? ""} isAdmin={isAdmin} />
      <main className="flex-1">
        <header
          className={`sticky top-0 z-10 flex items-center justify-end gap-3 px-8 py-3 border-b border-[var(--border)] backdrop-blur ${
            isTest ? "bg-amber-500/5" : "bg-[var(--background)]/80"
          }`}
        >
          {isTest && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Test mode — no real payments
            </span>
          )}
          <EnvToggle current={environment} />
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
