import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, industry, status")
    .order("name");

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
      <Sidebar userRole={userRole} />
      <main className="ml-56 flex-1 px-8 py-6 lg:px-12 lg:py-8">
        <PageHeader
          title="Clients"
          description="Select a client workspace to manage."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients && clients.length > 0 ? (
            clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}/dashboard`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent>
                    <p className="text-base font-semibold text-charcoal">
                      {client.name}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {client.industry && (
                        <span className="text-xs text-taupe-dark">
                          {client.industry}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-taupe-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-taupe-dark">
                        {client.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card>
              <CardContent>
                <p className="text-sm text-taupe-dark">
                  No clients yet. Run the seed migration to add demo data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
