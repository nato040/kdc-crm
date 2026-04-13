/**
 * Shared campaign query helpers for finance modules.
 *
 * Encapsulates the two-query pattern (campaigns first, then snapshots)
 * to avoid Supabase nested-select truncation. Used by:
 * - commission/calculator.ts (campaign revenue by day)
 * - finance/revenue.ts (monthly revenue totals)
 * - finance/period-analysis.ts (period summaries and campaign lists)
 *
 * All date boundaries use America/New_York timezone.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfDay, addDays, format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const TIMEZONE = "America/New_York" as const;

// ── Types ─────────────────────────────────────

export interface CampaignRow {
  id: string;
  campaign_name: string | null;
  send_time: string;
  channel: string | null;
}

export interface SnapshotFields {
  campaign_id: string;
  recipient_count: number | null;
  delivered_count: number | null;
  opens_unique: number | null;
  clicks_unique: number | null;
  open_rate: number | null;
  click_rate: number | null;
  bounce_rate: number | null;
  unsubscribe_rate: number | null;
  conversion_count: number | null;
  conversion_rate: number | null;
  conversion_value: number | null;
  revenue_per_recipient: number | null;
  average_order_value: number | null;
}

export interface CampaignWithSnapshot {
  campaign: CampaignRow;
  snapshot: SnapshotFields | null;
}

// ── Period boundary helpers ───────────────────

/**
 * Convert YYYY-MM-DD date strings to UTC timestamps representing
 * Eastern-time midnight boundaries. Returns a half-open interval
 * [start, end) so the last day is fully included.
 */
export function periodToUtcBounds(
  periodStart: string,
  periodEnd: string
): { startUtc: string; endExclusiveUtc: string } {
  const startDate = parseISO(periodStart);
  const endDate = parseISO(periodEnd);
  const startUtc = fromZonedTime(startOfDay(startDate), TIMEZONE);
  const endExclusiveUtc = fromZonedTime(
    startOfDay(addDays(endDate, 1)),
    TIMEZONE
  );
  return {
    startUtc: startUtc.toISOString(),
    endExclusiveUtc: endExclusiveUtc.toISOString(),
  };
}

// ── Core two-query pattern ────────────────────

/**
 * Fetch campaigns in a date range and their latest incremental
 * snapshots using two separate queries.
 *
 * Why two queries: Supabase nested selects return arrays per parent
 * row that can be silently truncated by PostgREST's default limit.
 * With multiple snapshots per campaign (after backfill or repeat
 * syncs), that produces silently wrong "latest" picks.
 *
 * @param supabase  - Any Supabase client (session or service-role)
 * @param clientId  - Client UUID
 * @param startUtc  - UTC ISO string, inclusive
 * @param endExclusiveUtc - UTC ISO string, exclusive
 */
export async function queryCampaignsWithLatestSnapshots(
  supabase: SupabaseClient,
  clientId: string,
  startUtc: string,
  endExclusiveUtc: string
): Promise<CampaignWithSnapshot[]> {
  // Query 1: campaigns in the period
  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, campaign_name, send_time, channel")
    .eq("client_id", clientId)
    .gte("send_time", startUtc)
    .lt("send_time", endExclusiveUtc)
    .not("send_time", "is", null);

  if (campaignsError) {
    throw new Error(`Failed to query campaigns: ${campaignsError.message}`);
  }

  const campaignList = (campaigns ?? []) as CampaignRow[];
  const campaignIds = campaignList.map((c) => c.id);

  if (campaignIds.length === 0) {
    return [];
  }

  // Query 2: all incremental snapshots for those campaigns, sorted DESC
  // so the first occurrence of each campaign_id is the most recent.
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("campaign_snapshots")
    .select(
      "campaign_id, recipient_count, delivered_count, opens_unique, clicks_unique, open_rate, click_rate, bounce_rate, unsubscribe_rate, conversion_count, conversion_rate, conversion_value, revenue_per_recipient, average_order_value, synced_at"
    )
    .in("campaign_id", campaignIds)
    .eq("run_type", "incremental")
    .order("synced_at", { ascending: false });

  if (snapshotsError) {
    throw new Error(
      `Failed to query campaign snapshots: ${snapshotsError.message}`
    );
  }

  // Build map: campaign_id -> latest snapshot (first occurrence wins)
  const latestSnapshotMap = new Map<string, SnapshotFields>();
  for (const snap of (snapshots ?? []) as (SnapshotFields & { synced_at: string })[]) {
    if (!latestSnapshotMap.has(snap.campaign_id)) {
      latestSnapshotMap.set(snap.campaign_id, {
        campaign_id: snap.campaign_id,
        recipient_count: snap.recipient_count,
        delivered_count: snap.delivered_count,
        opens_unique: snap.opens_unique,
        clicks_unique: snap.clicks_unique,
        open_rate: snap.open_rate,
        click_rate: snap.click_rate,
        bounce_rate: snap.bounce_rate,
        unsubscribe_rate: snap.unsubscribe_rate,
        conversion_count: snap.conversion_count,
        conversion_rate: snap.conversion_rate,
        conversion_value: snap.conversion_value,
        revenue_per_recipient: snap.revenue_per_recipient,
        average_order_value: snap.average_order_value,
      });
    }
  }

  // Join campaigns with their snapshots
  return campaignList.map((campaign) => ({
    campaign,
    snapshot: latestSnapshotMap.get(campaign.id) ?? null,
  }));
}

/**
 * Convenience: get just the snapshot map keyed by campaign_id.
 * Used by calculator.ts which only needs conversion_value.
 */
export async function queryLatestSnapshotMap(
  supabase: SupabaseClient,
  clientId: string,
  startUtc: string,
  endExclusiveUtc: string
): Promise<{
  campaigns: CampaignRow[];
  snapshotMap: Map<string, SnapshotFields>;
}> {
  const results = await queryCampaignsWithLatestSnapshots(
    supabase,
    clientId,
    startUtc,
    endExclusiveUtc
  );

  const campaigns = results.map((r) => r.campaign);
  const snapshotMap = new Map<string, SnapshotFields>();
  for (const r of results) {
    if (r.snapshot) {
      snapshotMap.set(r.campaign.id, r.snapshot);
    }
  }

  return { campaigns, snapshotMap };
}

/**
 * Format a date string to YYYY-MM in Eastern time.
 */
export function toEasternMonthKey(sendTimeIso: string): string {
  const sendTimeEastern = toZonedTime(parseISO(sendTimeIso), TIMEZONE);
  return format(sendTimeEastern, "yyyy-MM");
}

/**
 * Format a date string to YYYY-MM-DD in Eastern time.
 */
export function toEasternDayKey(sendTimeIso: string): string {
  const sendTimeEastern = toZonedTime(parseISO(sendTimeIso), TIMEZONE);
  return format(sendTimeEastern, "yyyy-MM-dd");
}
