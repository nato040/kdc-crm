import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { notFound } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Defense-in-depth: middleware already blocks non-admins,
  // but this layout-level check protects against middleware bugs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleRow || roleRow.role !== "admin") notFound();

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole="admin" />
      <main className="ml-56 flex-1 px-8 py-6 lg:px-12 lg:py-8">
        {children}
      </main>
    </div>
  );
}
