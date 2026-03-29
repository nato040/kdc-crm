import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage({
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
      <PageHeader title="Calendar" description="Planned and scheduled campaigns" />
      <CalendarClient clientId={id} />
    </>
  );
}
