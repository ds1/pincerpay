"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/provider";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/paywalls", label: "Paywalls" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 border-r border-[var(--border)] p-6 flex flex-col">
      <Link href="/dashboard" className="text-xl font-bold mb-8">
        Pincer<span className="text-[var(--primary)]">Pay</span>
      </Link>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(item.href)
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[var(--muted-foreground)] truncate">
          {email}
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors shrink-0"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
