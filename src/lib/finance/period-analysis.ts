/**
 * Period analysis query helpers for the Analysis page.
 *
 * Provides summary statistics and campaign lists for comparing
 * two arbitrary date ranges. Uses the shared two-query pattern
 * from query-helpers.ts to avoid Supabase nested-select truncation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  queryCampaignsWithLatestSnapshots,
  periodToUtcBounds,
  toEasternDayKey,
  type CampaignWithSnapshot,
} from "./query-helpers";

// ── Types ─────────────────────────────────────

export interface PeriodSummary {
  campaignCount: number;
  totalRevenue: number;
  totalRecipients: number;
  avgRecipientsPerSend: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgConversionRate: number;
  revenuePerRecipient: number;
}

export interface PeriodCampaign {
  id: string;
  sendDate: string;
  campaignName: string;
  channel: string;
  recipientCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  conversionValue: number;
  revenuePerRecipient: number;
}

// ── Private helpers ───────────────────────────

function computeSummary(results: CampaignWithSnapshot[]): PeriodSummary {
  const withSnapshots = results.filter((r) => r.snapshot !== null);
  const campaignCount = withSnapshots.length;

  if (campaignCount === 0) {
    return {
      campaignCount: 0,
      totalRevenue: 0,
      totalRecipients: 0,
      avgRecipientsPerSend: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      avgConversionRate: 0,
      revenuePerRecipient: 0,
    };
  }

  let totalRevenue = 0;
  let totalRecipients = 0;
  let sumOpenRate = 0;
  let sumClickRate = 0;
  let sumConversionRate = 0;

  for (const r of withSnapshots) {
    const s = r.snapshot!;
    totalRevenue += s.conversion_value ?? 0;
    totalRecipients += s.recipient_count ?? 0;
    sumOpenRate += s.open_rate ?? 0;
    sumClickRate += s.click_rate ?? 0;
    sumConversionRate += s.conversion_rate ?? 0;
  }

  return {
    campaignCount,
    totalRevenue,
    totalRecipients,
    avgRecipientsPerSend:
      campaignCount > 0 ? totalRecipients / campaignCount : 0,
    avgOpenRate: campaignCount > 0 ? sumOpenRate / campaignCount : 0,
    avgClickRate: campaignCount > 0 ? sumClickRate / campaignCount : 0,
    avgConversionRate:
      campaignCount > 0 ? sumConversionRate / campaignCount : 0,
    revenuePerRecipient:
      totalRecipients > 0 ? totalRevenue / totalRecipients : 0,
  };
}

function toPeriodCampaign(r: CampaignWithSnapshot): PeriodCampaign {
  const s = r.snapshot;
  return {
    id: r.campaign.id,
    sendDate: toEasternDayKey(r.campaign.send_time),
    campaignName: r.campaign.campaign_name ?? "Untitled",
    channel: r.campaign.channel ?? "unknown",
    recipientCount: s?.recipient_count ?? 0,
    openRate: s?.open_rate ?? 0,
    clickRate: s?.click_rate ?? 0,
    conversionRate: s?.conversion_rate ?? 0,
    conversionValue: s?.conversion_value ?? 0,
    revenuePerRecipient: s?.revenue_per_recipient ?? 0,
  };
}

// ── Public API ────────────────────────────────

/**
 * Compute summary statistics for campaigns in a date range.
 * Used by Analysis page Sections 1 and 2.
 */
export async function queryPeriodSummary(
  supabase: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<PeriodSummary> {
  const { startUtc, endExclusiveUtc } = periodToUtcBounds(
    periodStart,
    periodEnd
  );

  const results = await queryCampaignsWithLatestSnapshots(
    supabase,
    clientId,
    startUtc,
    endExclusiveUtc
  );

  return computeSummary(results);
}

/**
 * Fetch full campaign list with metrics for a date range.
 * Used by Analysis page Section 4.
 * Returns campaigns sorted by send_time descending (most recent first).
 */
export async function queryPeriodCampaigns(
  supabase: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<PeriodCampaign[]> {
  const { startUtc, endExclusiveUtc } = periodToUtcBounds(
    periodStart,
    periodEnd
  );

  const results = await queryCampaignsWithLatestSnapshots(
    supabase,
    clientId,
    startUtc,
    endExclusiveUtc
  );

  // Sort by send_time descending, then map to PeriodCampaign
  return results
    .sort(
      (a, b) =>
        new Date(b.campaign.send_time).getTime() -
        new Date(a.campaign.send_time).getTime()
    )
    .map(toPeriodCampaign);
}
