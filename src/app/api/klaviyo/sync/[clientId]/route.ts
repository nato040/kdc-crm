import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getCampaigns,
  getCampaignValuesReport,
  getFlows,
  getFlowValuesReport,
  getMetrics,
} from "@/lib/klaviyo/client";
import {
  KlaviyoError,
  KlaviyoAuthError,
  KlaviyoRateLimitError,
} from "@/lib/klaviyo/errors";
import type { KlaviyoStats } from "@/lib/klaviyo/types";

export const maxDuration = 300;

// ── Constants ───────────────────────────────

// Fallback window when last_synced_at is null and backfill_complete is false.
// Replaced by full two-mode backfill in a later phase.
const INCREMENTAL_SYNC_WINDOW_DAYS = 1095;
const PLACED_ORDER_METRIC_NAME = "Placed Order";

// ── Route handler ───────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  // 1. AUTH CHECK
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. SERVICE CLIENT
  const service = createServiceClient();

  // 3. FETCH API KEY FROM VAULT
  const { data: keyData, error: keyError } = await service.rpc(
    "get_klaviyo_key",
    { p_client_id: clientId }
  );

  if (keyError || !keyData) {
    return NextResponse.json(
      { error: "No API key configured for this client" },
      { status: 400 }
    );
  }

  // 4. INSERT SYNC RUN
  const startTime = Date.now();
  const { data: syncRun, error: syncRunError } = await service
    .from("sync_runs")
    .insert({ client_id: clientId, status: "running", run_type: "incremental" })
    .select("id")
    .single();

  if (syncRunError || !syncRun) {
    return NextResponse.json(
      { error: "Failed to create sync run" },
      { status: 500 }
    );
  }

  // 5. COMPUTE SYNC WINDOW
  const apiKey = keyData as string;
  const sinceDate = new Date(
    Date.now() - INCREMENTAL_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const nowDate = new Date();

  let campaignsIdentified = 0;
  let campaignsSkippedDrafts = 0;
  let campaignsMissingStats = 0;
  let campaignsSnapshotted = 0;
  let flowsIdentified = 0;
  let flowsMissingStats = 0;
  let flowsSnapshotted = 0;
  let campaignError: string | null = null;
  let flowError: string | null = null;

  // 6. RESOLVE "PLACED ORDER" METRIC ID
  let conversionMetricId: string | null = null;
  try {
    const metrics = await getMetrics(apiKey);
    const placedOrder = metrics.find(
      (m) => m.name === PLACED_ORDER_METRIC_NAME
    );
    conversionMetricId = placedOrder?.id ?? null;
    if (!conversionMetricId) {
      console.debug(
        `[sync] No '${PLACED_ORDER_METRIC_NAME}' metric found for client ${clientId} — conversion stats will be null`
      );
    }
  } catch (error) {
    // If we can't even fetch metrics, both blocks will likely fail too.
    // But we try anyway — getCampaigns/getFlows don't need the metric ID.
    console.debug(
      `[sync] Failed to fetch metrics: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  // ── CAMPAIGNS BLOCK ─────────────────────────

  try {
    // 7. FETCH CAMPAIGNS (email then SMS, sequential internally)
    const campaigns = await getCampaigns(apiKey, sinceDate);

    // 8. UPSERT IDENTITY ROWS FIRST — lands even if reports fail later
    const campaignIdMap = new Map<string, string>(); // klaviyo ID → internal UUID
    for (const campaign of campaigns) {
      const { data: upserted } = await service
        .from("campaigns")
        .upsert(
          {
            client_id: clientId,
            klaviyo_id: campaign.id,
            channel: campaign.channel,
            campaign_name: campaign.name,
            subject_line: campaign.subjectLine,
            preview_text: campaign.previewText,
            from_email: campaign.fromEmail,
            from_label: campaign.fromLabel,
            send_time: campaign.sendTime,
            status: campaign.status,
            archived: campaign.archived,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,klaviyo_id" }
        )
        .select("id")
        .single();

      if (upserted) {
        campaignIdMap.set(campaign.id, upserted.id);
      }
    }
    campaignsIdentified = campaigns.length;

    // 9. FETCH CAMPAIGN VALUES REPORT
    let campaignStats = new Map<string, KlaviyoStats>();
    if (campaigns.length > 0 && conversionMetricId) {
      campaignStats = await getCampaignValuesReport(
        apiKey,
        campaigns.map((c) => c.id),
        conversionMetricId,
        sinceDate,
        nowDate
      );
    }

    // 10. INSERT SNAPSHOTS (second pass — uses identity map from step 8)
    for (const campaign of campaigns) {
      // Draft campaigns have no engagement data yet — identity row is
      // upserted above, snapshot is deferred until first send.
      if (!campaign.sendTime) {
        campaignsSkippedDrafts++;
        continue;
      }

      const internalId = campaignIdMap.get(campaign.id);
      const stats = campaignStats.get(campaign.id);

      // Insert snapshot only if we have both the internal ID and stats
      if (internalId && stats) {
        await service.from("campaign_snapshots").insert({
          campaign_id: internalId,
          run_type: "incremental",
          period_start: campaign.sendTime,
          period_end: nowDate.toISOString(),
          recipient_count: stats.recipients,
          delivered_count: stats.delivered,
          opens_unique: stats.opensUnique,
          clicks_unique: stats.clicksUnique,
          open_rate: stats.openRate,
          click_rate: stats.clickRate,
          bounce_rate: stats.bounceRate,
          unsubscribe_rate: stats.unsubscribeRate,
          conversion_count: stats.conversions,
          conversion_value: stats.conversionValue,
          conversion_rate: stats.conversionRate,
          revenue_per_recipient: stats.revenuePerRecipient,
          average_order_value: stats.averageOrderValue,
        });
        campaignsSnapshotted++;
      } else {
        // Has sendTime but Klaviyo returned no metrics in the report window
        campaignsMissingStats++;
      }
    }

    // Arithmetic assertion: counter totals must match identified count
    const campaignCounterSum =
      campaignsSkippedDrafts + campaignsMissingStats + campaignsSnapshotted;
    if (campaignCounterSum !== campaignsIdentified) {
      console.error(
        `[sync] Campaign counter mismatch: identified=${campaignsIdentified} but skipped_drafts(${campaignsSkippedDrafts}) + missing_stats(${campaignsMissingStats}) + snapshotted(${campaignsSnapshotted}) = ${campaignCounterSum}`
      );
      throw new Error(
        `Campaign counter arithmetic failed: ${campaignsIdentified} !== ${campaignCounterSum}`
      );
    }
  } catch (error) {
    campaignError =
      error instanceof KlaviyoError
        ? error.message
        : "Campaign sync failed unexpectedly";
    console.debug(`[sync] Campaigns block failed: ${campaignError}`);
    // Don't rethrow — attempt flows
  }

  // ── FLOWS BLOCK ─────────────────────────────

  try {
    // 11. FETCH FLOWS
    const flows = await getFlows(apiKey);

    // 12. UPSERT IDENTITY ROWS FIRST — lands even if reports fail later
    const flowIdMap = new Map<string, string>(); // klaviyo ID → internal UUID
    for (const flow of flows) {
      const { data: upserted } = await service
        .from("flows")
        .upsert(
          {
            client_id: clientId,
            klaviyo_id: flow.id,
            flow_name: flow.name,
            flow_status: flow.status,
            trigger_type: flow.triggerType,
            archived: flow.archived,
            created_at_klaviyo: flow.created || null,
            updated_at_klaviyo: flow.updated || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,klaviyo_id" }
        )
        .select("id")
        .single();

      if (upserted) {
        flowIdMap.set(flow.id, upserted.id);
      }
    }
    flowsIdentified = flows.length;

    // 13. FETCH FLOW VALUES REPORT
    let flowStats = new Map<string, KlaviyoStats>();
    if (flows.length > 0 && conversionMetricId) {
      flowStats = await getFlowValuesReport(
        apiKey,
        flows.map((f) => f.id),
        conversionMetricId,
        sinceDate,
        nowDate
      );
    }

    // 14. INSERT SNAPSHOTS (second pass — uses identity map from step 12)
    for (const flow of flows) {
      const internalId = flowIdMap.get(flow.id);
      const stats = flowStats.get(flow.id);

      if (internalId && stats) {
        await service.from("flow_snapshots").insert({
          flow_id: internalId,
          run_type: "incremental",
          period_start: sinceDate.toISOString(),
          period_end: nowDate.toISOString(),
          recipient_count: stats.recipients,
          delivered_count: stats.delivered,
          opens_unique: stats.opensUnique,
          clicks_unique: stats.clicksUnique,
          open_rate: stats.openRate,
          click_rate: stats.clickRate,
          bounce_rate: stats.bounceRate,
          unsubscribe_rate: stats.unsubscribeRate,
          conversion_count: stats.conversions,
          conversion_value: stats.conversionValue,
          conversion_rate: stats.conversionRate,
          revenue_per_recipient: stats.revenuePerRecipient,
          average_order_value: stats.averageOrderValue,
        });
        flowsSnapshotted++;
      } else {
        flowsMissingStats++;
      }
    }

    // Arithmetic assertion: counter totals must match identified count
    const flowCounterSum = flowsSnapshotted + flowsMissingStats;
    if (flowCounterSum !== flowsIdentified) {
      console.error(
        `[sync] Flow counter mismatch: identified=${flowsIdentified} but snapshotted(${flowsSnapshotted}) + missing_stats(${flowsMissingStats}) = ${flowCounterSum}`
      );
      throw new Error(
        `Flow counter arithmetic failed: ${flowsIdentified} !== ${flowCounterSum}`
      );
    }
  } catch (error) {
    flowError =
      error instanceof KlaviyoError
        ? error.message
        : "Flow sync failed unexpectedly";
    console.debug(`[sync] Flows block failed: ${flowError}`);
  }

  // ── DETERMINE FINAL STATUS ──────────────────

  const durationMs = Date.now() - startTime;
  let finalStatus: "success" | "partial" | "error";
  let combinedError: string | null = null;

  if (!campaignError && !flowError) {
    finalStatus = "success";
  } else if (campaignsIdentified > 0 || flowsIdentified > 0) {
    // Identity data landed even though reports or snapshots failed — partial success
    finalStatus = "partial";
    combinedError =
      campaignError && flowError
        ? `Campaigns: ${campaignError}; Flows: ${flowError}`
        : campaignError
          ? `Campaigns failed: ${campaignError}`
          : `Flows failed: ${flowError}`;
  } else {
    // Nothing landed at all — getCampaigns/getFlows themselves failed
    finalStatus = "error";
    combinedError =
      campaignError && flowError
        ? `Campaigns: ${campaignError}; Flows: ${flowError}`
        : campaignError ?? flowError ?? "Sync failed";
  }

  // ── UPDATE last_synced_at (CONDITIONAL) ─────
  // Only on success or partial — "last time we got data", not "last time we tried"

  if (finalStatus === "success" || finalStatus === "partial") {
    await service
      .from("clients")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", clientId);
  }

  // ── UPDATE SYNC RUN ─────────────────────────

  await service
    .from("sync_runs")
    .update({
      status: finalStatus,
      campaigns_synced: campaignsSnapshotted,
      flows_synced: flowsSnapshotted,
      error: combinedError,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
    })
    .eq("id", syncRun.id);

  // ── RETURN RESPONSE ─────────────────────────

  if (finalStatus === "success") {
    return NextResponse.json({
      ok: true,
      campaigns_identified: campaignsIdentified,
      campaigns_skipped_drafts: campaignsSkippedDrafts,
      campaigns_missing_stats: campaignsMissingStats,
      campaigns_snapshotted: campaignsSnapshotted,
      flows_identified: flowsIdentified,
      flows_missing_stats: flowsMissingStats,
      flows_snapshotted: flowsSnapshotted,
      duration_ms: durationMs,
    });
  }

  if (finalStatus === "partial") {
    return NextResponse.json(
      {
        ok: true,
        partial: true,
        campaigns_identified: campaignsIdentified,
        campaigns_skipped_drafts: campaignsSkippedDrafts,
        campaigns_missing_stats: campaignsMissingStats,
        campaigns_snapshotted: campaignsSnapshotted,
        flows_identified: flowsIdentified,
        flows_missing_stats: flowsMissingStats,
        flows_snapshotted: flowsSnapshotted,
        duration_ms: durationMs,
        error: combinedError,
      },
      { status: 207 }
    );
  }

  // finalStatus === 'error'
  // Determine the most specific error type for the HTTP status
  const firstError = campaignError ?? flowError ?? "Sync failed";
  if (firstError.includes("Invalid or expired")) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (firstError.includes("rate limit")) {
    return NextResponse.json(
      { error: "Klaviyo rate limit exceeded" },
      { status: 429 }
    );
  }
  return NextResponse.json({ error: combinedError }, { status: 500 });
}
