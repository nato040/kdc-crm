import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { BriefsClient } from "./briefs-client";

export default async function BriefsPage({
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
      <PageHeader title="Briefs" description="Campaign and creative briefs" />
      <BriefsClient clientId={id} />
    </>
  );
}
