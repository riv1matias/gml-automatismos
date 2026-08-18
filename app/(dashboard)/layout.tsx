import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{ display: "flex" }}>
      <Sidebar email={user.email ?? ""} />
      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 1100 }}>{children}</main>
    </div>
  );
}
