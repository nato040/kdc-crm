import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { UploadsClient } from "./uploads-client";

export default async function UploadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", id)
    .single();

  if (!client) notFound();

  return (
    <>
      <PageHeader
        title="Uploads"
        description="Upload Klaviyo CSV exports to ingest campaign and flow data."
      />
      <UploadsClient clientId={id} />
    </>
  );
}
