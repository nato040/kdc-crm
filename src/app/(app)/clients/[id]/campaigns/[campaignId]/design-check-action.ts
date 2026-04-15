"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DESIGN_STANDARDS_PROMPT = `You are an email design auditor for a fashion/lifestyle DTC brand. You evaluate email campaign designs against these published performance standards:

1. ONE DOMINANT CTA — Every email must have a single, clear primary call-to-action. Multiple competing CTAs cause confusion and reduce click-through rate.

2. LIMITED MODULES — Emails should have a focused number of content sections. Too many modules cause cognitive overload and disperse user attention.

3. NO DENSE PRODUCT GRIDS — Avoid grid layouts packed with many small product images. Use curated, editorial layouts that guide the eye. Grid overuse correlates with lower CTR.

4. FULL PRODUCT VISIBILITY — All product images must show the complete product. No cropping that hides the product shape, details, or context. Cropped products reduce purchase confidence.

5. LARGE, MOBILE-VISIBLE CTA BUTTONS — CTA buttons must be large enough to tap on mobile and visually prominent. Small or hidden CTAs directly reduce conversion.

6. CONSISTENT VISUAL HIERARCHY — The email should have a clear top-to-bottom reading flow with one focal point. Lack of hierarchy causes users to scan randomly and miss the intended action.

7. MERCHANDISING ALIGNMENT — The design should support the merchandising strategy (sets, value propositions, AOV drivers). Design that contradicts the merchandising intent wastes the campaign.

Look at the email image provided. Evaluate it against ALL SEVEN standards above.

Return ONLY a JSON object with exactly this shape, no other text:
{"verdict": "PASS" or "FAIL", "reason": "One sentence explaining the primary issue or why it passes."}

Rules:
- If ANY of the 7 standards is clearly violated, the verdict is FAIL.
- The reason should name the SPECIFIC standard that was most egregiously violated.
- If the email passes all 7 standards reasonably well, the verdict is PASS with a brief positive note.
- Be strict. These standards exist because violations directly hurt revenue.
- Return ONLY the JSON object. No markdown, no backticks, no preamble, no explanation.`;

export async function runDesignCheck(
  campaignId: string,
  clientId: string
): Promise<{ success: boolean; verdict?: string; reason?: string; error?: string }> {
  // Defense in depth: verify caller is admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleRow || roleRow.role !== "admin") {
    return { success: false, error: "Only admins can run design checks" };
  }

  // Fetch the campaign to get the design image URL
  const { data: campaign, error: fetchError } = await supabase
    .from("campaigns")
    .select("figma_url")
    .eq("id", campaignId)
    .single();

  if (fetchError || !campaign) {
    return { success: false, error: "Campaign not found" };
  }

  if (!campaign.figma_url) {
    return { success: false, error: "No design image uploaded. Upload an image first." };
  }

  // Call Claude API with the image
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: campaign.figma_url,
              },
            },
            {
              type: "text",
              text: DESIGN_STANDARDS_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract text response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response — strip any markdown backticks Claude might add despite instructions
    const raw = textBlock.text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: { verdict: string; reason: string };

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Failed to parse Claude response:", raw);
      // Fall back to FAIL with the raw response as context
      parsed = { verdict: "FAIL", reason: "Analysis completed but could not parse structured response." };
    }

    // Validate verdict is PASS or FAIL
    const verdict = parsed.verdict === "PASS" ? "PASS" : "FAIL";
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "No reason provided.";

    // Store the result
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        design_check_verdict: verdict,
        design_check_reason: reason,
        design_check_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (updateError) {
      return { success: false, error: `Failed to save result: ${updateError.message}` };
    }

    revalidatePath(`/clients/${clientId}/campaigns/${campaignId}`);
    revalidatePath(`/clients/${clientId}/campaigns`);
    revalidatePath(`/clients/${clientId}/email-builder`);

    return { success: true, verdict, reason };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Claude API error:", message);
    return { success: false, error: `AI analysis failed: ${message}` };
  }
}
