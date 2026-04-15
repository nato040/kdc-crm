"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function setCampaignFigmaUrl(
  campaignId: string,
  rawUrl: string | null,
  clientId: string
) {
  const supabase = await createClient();

  // Defense in depth: verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleRow || roleRow.role !== "admin") {
    throw new Error("Only admins can edit campaign metadata");
  }

  // Validate URL: must be null OR start with https://www.figma.com/ or https://figma.com/
  let cleanUrl: string | null = null;
  if (rawUrl && rawUrl.trim()) {
    const trimmed = rawUrl.trim();
    if (!trimmed.match(/^https:\/\/(www\.)?figma\.com\//)) {
      throw new Error("URL must be a Figma URL (https://www.figma.com/...)");
    }
    cleanUrl = trimmed;
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ figma_url: cleanUrl })
    .eq("id", campaignId);

  if (error) throw new Error(`Failed to update: ${error.message}`);

  revalidatePath(`/clients/${clientId}/campaigns/${campaignId}`);
  revalidatePath(`/clients/${clientId}/campaigns`);
}
