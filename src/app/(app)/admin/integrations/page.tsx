import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { KlaviyoIntegration } from "./klaviyo-integration";

export default async function AdminIntegrationsPage() {
  const supabase = await createClient();

  // For v1, query the single existing client
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, klaviyo_key_id, last_synced_at")
    .limit(1);

  const client = clients?.[0];
  if (!client) notFound();

  return (
    <>
      <PageHeader
        title="Integrations"
        description={`Data connections for ${client.name}`}
      />

      <div className="space-y-6">
        <KlaviyoIntegration
          clientId={client.id}
          hasKey={!!client.klaviyo_key_id}
          lastSyncedAt={client.last_synced_at}
        />

        {/* Future: Shopify, Meta Ads, GA cards slot in here */}
      </div>
    </>
  );
}
