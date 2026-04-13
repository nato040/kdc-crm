/**
 * Commission calculator — pure computation module.
 *
 * Given a client_id and billing period, queries campaign and flow data
 * from the database and produces a draft commission statement with
 * per-day credit breakdowns. Does NOT write to the database — the
 * writer module handles persistence.
 *
 * All currency values are rounded to 2 decimal places at the output
 * boundary using banker's rounding. Internal computations use raw floats.
 *
 * Timezone: all calendar-day logic uses America/New_York (Cody's local
 * time). A campaign sent at 2026-01-01T04:00:00Z is a Dec 31 campaign
 * in her view, not Jan 1.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eachDayOfInterval, addDays, startOfDay, format, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { queryLatestSnapshotMap } from "../finance/query-helpers";
import type {
  ComputeInput,
  ComputeOutput,
  StatementDraft,
  CreditDayRow,
  ComputeDiagnostics,
} from "./types";
import {
  COMMISSION_RATE,
  DAILY_CAMPAIGN_THRESHOLD,
  DAILY_COMBINED_THRESHOLD,
  CREDITS_TARGET,
  TIMEZONE,
} from "./config";

// ── Private helpers ────────────────────────────

/**
 * Round to 2 decimal places using banker's rounding (round half to even).
 * Avoids systematic bias from always-round-up across many values.
 *
 * Example: 2.345 → 2.34 (not 2.35), 2.355 → 2.36
 */
function round2(value: number): number {
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  // Banker's rounding for exact .5 cases
  if (Math.abs(scaled - Math.trunc(scaled)) === 0.5) {
    const truncated = Math.trunc(scaled);
    return (truncated % 2 === 0 ? truncated : rounded) / 100;
  }
  return rounded / 100;
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Query campaigns in the billing period and their latest incremental
 * snapshots. Delegates to the shared two-query helper in
 * finance/query-helpers.ts, then aggregates revenue by Eastern-time
 * calendar day for commission calculation.
 */
async function queryCampaignRevenueByDay(
  supabase: SupabaseClient,
  clientId: string,
  periodStartUtc: string,
  periodEndExclusiveUtc: string
): Promise<{
  revenueByDay: Map<string, number>;
  campaignsConsidered: number;
  campaignsMissingSnapshots: number;
}> {
  const { campaigns, snapshotMap } = await queryLatestSnapshotMap(
    supabase,
    clientId,
    periodStartUtc,
    periodEndExclusiveUtc
  );

  // Diagnostics
  const campaignsConsidered = campaigns.length;
  const campaignsMissingSnapshots = campaignsConsidered - snapshotMap.size;

  // Aggregate revenue by Eastern-time calendar day
  const revenueByDay = new Map<string, number>();
  for (const campaign of campaigns) {
    const snap = snapshotMap.get(campaign.id);
    if (!snap) continue; // missing snapshot, already counted

    const revenue = snap.conversion_value ?? 0;
    const sendTimeUtc = parseISO(campaign.send_time!);
    const sendTimeEastern = toZonedTime(sendTimeUtc, TIMEZONE);
    const dayKey = format(sendTimeEastern, "yyyy-MM-dd");

    revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? 0) + revenue);
  }

  return { revenueByDay, campaignsConsidered, campaignsMissingSnapshots };
}

// v1 flow revenue approximation: we sum each flow's most recent incremental
// snapshot's conversion_value and allocate the total uniformly across days
// in the billing period for the daily credit test. The snapshot represents
// an aggregate over whatever window was most recently synced, not a calendar
// month. For commission total this is fine because flows don't contribute
// to commission per Cody's contract — only campaigns do. For the daily
// credit test this is an approximation because flow revenue isn't actually
// uniform day-to-day.
//
// v2: implement Klaviyo Events API integration for true per-day flow
// revenue, stored in a new flow_daily_revenue table. See roadmap Tier 1.

/**
 * Query all flows for the client and their latest incremental snapshots.
 * Same two-query pattern as campaigns — avoids nested-select truncation.
 *
 * Returns aggregate flow revenue and diagnostic counts.
 */
async function queryFlowRevenue(
  supabase: SupabaseClient,
  clientId: string
): Promise<{
  flowsRevenueTotal: number;
  flowsConsidered: number;
  flowsMissingSnapshots: number;
}> {
  // Query 1: all flows for the client
  const { data: flows, error: flowsError } = await supabase
    .from("flows")
    .select("id")
    .eq("client_id", clientId);

  if (flowsError) {
    throw new Error(`Failed to query flows: ${flowsError.message}`);
  }

  const flowList = flows ?? [];
  const flowIds = flowList.map((f) => f.id as string);

  // Query 2: all incremental snapshots for those flows, sorted DESC
  let flowSnapshots: Array<{
    flow_id: string;
    conversion_value: number | null;
  }> = [];

  if (flowIds.length > 0) {
    const { data, error } = await supabase
      .from("flow_snapshots")
      .select("flow_id, conversion_value, synced_at")
      .in("flow_id", flowIds)
      .eq("run_type", "incremental")
      .order("synced_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to query flow snapshots: ${error.message}`);
    }
    flowSnapshots = (data ?? []) as Array<{
      flow_id: string;
      conversion_value: number | null;
    }>;
  }

  // Build map: flow_id → latest incremental conversion_value.
  // Snapshots sorted DESC by synced_at, so first occurrence wins.
  const latestFlowRevenue = new Map<string, number>();
  for (const snap of flowSnapshots) {
    if (!latestFlowRevenue.has(snap.flow_id)) {
      latestFlowRevenue.set(snap.flow_id, snap.conversion_value ?? 0);
    }
  }

  // Sum across all flows
  let flowsRevenueTotal = 0;
  for (const value of latestFlowRevenue.values()) {
    flowsRevenueTotal += value;
  }

  const flowsConsidered = flowList.length;
  const flowsMissingSnapshots = flowsConsidered - latestFlowRevenue.size;

  return { flowsRevenueTotal, flowsConsidered, flowsMissingSnapshots };
}

// ── Public API ─────────────────────────────────

/**
 * Compute a draft commission statement for a client and billing period.
 *
 * Returns a statement draft, per-day credit breakdowns, and diagnostics.
 * Does NOT write to the database — pass the output to saveStatement()
 * from writer.ts when ready to persist.
 */
export async function computeCommission(
  input: ComputeInput
): Promise<ComputeOutput> {
  // ── Step A: Input validation and setup ──

  const { clientId, periodStart, periodEnd } = input;

  if (!clientId || clientId.trim().length === 0) {
    throw new Error("clientId must be a non-empty string");
  }

  const periodStartDate = parseISO(periodStart);
  const periodEndDate = parseISO(periodEnd);

  if (isNaN(periodStartDate.getTime())) {
    throw new Error(`Invalid periodStart date: ${periodStart}`);
  }
  if (isNaN(periodEndDate.getTime())) {
    throw new Error(`Invalid periodEnd date: ${periodEnd}`);
  }
  if (periodStartDate > periodEndDate) {
    throw new Error(
      `periodStart (${periodStart}) must be before or equal to periodEnd (${periodEnd})`
    );
  }

  // Resolve defaults from config.ts
  const commissionRate = input.commissionRate ?? COMMISSION_RATE;
  const dailyCampaignThreshold =
    input.dailyCampaignThreshold ?? DAILY_CAMPAIGN_THRESHOLD;
  const dailyCombinedThreshold =
    input.dailyCombinedThreshold ?? DAILY_COMBINED_THRESHOLD;
  const creditsTarget = input.creditsTarget ?? CREDITS_TARGET;

  const supabase = createServiceClient();

  // ── Step B: Compute period boundaries in UTC ──

  // periodStart is the first day of the billing period in Eastern time.
  // We want the UTC timestamp of "midnight Eastern" for that day.
  const periodStartUtc = fromZonedTime(startOfDay(periodStartDate), TIMEZONE);

  // periodEnd is the last day. We want the UTC timestamp of "start of the
  // day AFTER" so the range is [start, end) — half-open interval avoids
  // off-by-one on the boundary.
  const periodEndExclusiveUtc = fromZonedTime(
    startOfDay(addDays(periodEndDate, 1)),
    TIMEZONE
  );

  // ── Step C: Query campaign revenue per day ──
  // Two separate queries (campaigns, then their snapshots) to avoid
  // Supabase nested-select truncation on the snapshot array.

  const {
    revenueByDay: campaignRevenueByDay,
    campaignsConsidered,
    campaignsMissingSnapshots,
  } = await queryCampaignRevenueByDay(
    supabase,
    clientId,
    periodStartUtc.toISOString(),
    periodEndExclusiveUtc.toISOString()
  );

  // ── Step D: Query aggregate flow revenue ──

  const { flowsRevenueTotal, flowsConsidered, flowsMissingSnapshots } =
    await queryFlowRevenue(supabase, clientId);

  // ── Step E: Day-by-day iteration ──

  const daysInPeriod = eachDayOfInterval({
    start: periodStartDate,
    end: periodEndDate,
  });
  const totalDays = daysInPeriod.length;
  const flowsRevenuePerDay = totalDays > 0 ? flowsRevenueTotal / totalDays : 0;

  const creditDays: CreditDayRow[] = [];
  let creditsEarned = 0;
  let campaignsRevenueTotal = 0;

  for (const day of daysInPeriod) {
    const dayKey = format(day, "yyyy-MM-dd");
    const dailyCampaigns = campaignRevenueByDay.get(dayKey) ?? 0;
    const dailyFlows = flowsRevenuePerDay;
    const dailyTotal = dailyCampaigns + dailyFlows;

    const passedCampaign = dailyCampaigns >= dailyCampaignThreshold;
    const passedCombined = dailyTotal >= dailyCombinedThreshold;
    const creditEarned = passedCampaign || passedCombined;

    if (creditEarned) creditsEarned++;
    campaignsRevenueTotal += dailyCampaigns;

    // ── Step F: Round at the boundary ──
    creditDays.push({
      day: dayKey,
      campaignsRevenue: round2(dailyCampaigns),
      flowsRevenueAllocated: round2(dailyFlows),
      totalRevenue: round2(dailyTotal),
      passedCampaignThreshold: passedCampaign,
      passedCombinedThreshold: passedCombined,
      creditEarned,
    });
  }

  // ── Step G: Build the statement draft ──

  const commissionAmount = round2(campaignsRevenueTotal * commissionRate);

  const statement: StatementDraft = {
    clientId,
    periodStart,
    periodEnd,
    campaignsRevenue: round2(campaignsRevenueTotal),
    flowsRevenue: round2(flowsRevenueTotal),
    commissionRate,
    commissionAmount,
    creditsEarned,
    creditsTarget,
    dailyCampaignThreshold,
    dailyCombinedThreshold,
    status: "draft",
  };

  const diagnostics: ComputeDiagnostics = {
    campaignsConsidered,
    campaignsMissingSnapshots,
    flowsConsidered,
    flowsMissingSnapshots,
  };

  return { statement, creditDays, diagnostics };
}
