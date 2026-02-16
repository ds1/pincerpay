import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";

export const dynamic = "force-dynamic";

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
      <Sidebar email={user.email ?? ""} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
