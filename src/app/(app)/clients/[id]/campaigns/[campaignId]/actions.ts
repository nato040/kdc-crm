"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function setCampaignDesignUrl(
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

  // Validate URL: must be null OR a valid HTTPS URL pointing at an image
  let cleanUrl: string | null = null;
  if (rawUrl && rawUrl.trim()) {
    const trimmed = rawUrl.trim();

    // Must be HTTPS
    if (!trimmed.match(/^https:\/\//)) {
      throw new Error("URL must be HTTPS");
    }

    // Should look like an image — accept common extensions OR known image hosts
    const looksLikeImage = trimmed.match(
      /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i
    );
    const knownImageHost = trimmed.match(
      /^https:\/\/(i\.imgur\.com|imgur\.com|.*\.supabase\.co\/storage|.*\.cloudinary\.com|.*\.amazonaws\.com|raw\.githubusercontent\.com)/
    );

    if (!looksLikeImage && !knownImageHost) {
      throw new Error(
        "URL must point to an image (.jpg, .png, .webp, .gif) or a known image host (Imgur, Supabase Storage, Cloudinary, S3, GitHub)"
      );
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
