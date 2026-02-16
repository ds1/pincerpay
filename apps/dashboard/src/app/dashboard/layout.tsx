import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/paywalls", label: "Paywalls" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] p-6 flex flex-col">
        <Link href="/dashboard" className="text-xl font-bold mb-8">
          Pincer<span className="text-[var(--primary)]">Pay</span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="text-sm text-[var(--muted-foreground)] truncate">
          {user.email}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
