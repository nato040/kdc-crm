import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { notFound } from "next/navigation";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // Fetch current user's role for conditional sidebar rendering
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: string | undefined;
  if (user) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    userRole = roleRow?.role ?? undefined;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar clientId={client.id} clientName={client.name} userRole={userRole} />
      <main className="ml-56 flex-1 px-8 py-6 lg:px-12 lg:py-8">
        {children}
      </main>
    </div>
  );
}
