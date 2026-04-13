/**
 * Revenue query helpers for the Finance page.
 *
 * These functions compute raw campaign revenue (not commission) for
 * use in account performance views. They use the shared two-query
 * pattern from query-helpers.ts to avoid Supabase nested-select
 * truncation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  queryCampaignsWithLatestSnapshots,
  periodToUtcBounds,
  toEasternMonthKey,
} from "./query-helpers";

/**
 * Total raw campaign revenue for a date range.
 * Used by Finance page Panel 3 for the 24-month account performance view.
 *
 * @param clientId    - Client UUID
 * @param periodStart - YYYY-MM-DD, inclusive (Eastern time)
 * @param periodEnd   - YYYY-MM-DD, inclusive (Eastern time)
 */
export async function queryMonthlyRevenue(
  supabase: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<number> {
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

  let total = 0;
  for (const r of results) {
    if (r.snapshot) {
      total += r.snapshot.conversion_value ?? 0;
    }
  }

  return total;
}

/**
 * Campaign revenue broken down by calendar month.
 * Returns one row per month that has at least one campaign.
 * Used by Finance page Panel 3 for sparkline rendering.
 *
 * @param clientId    - Client UUID
 * @param periodStart - YYYY-MM-DD, inclusive (Eastern time)
 * @param periodEnd   - YYYY-MM-DD, inclusive (Eastern time)
 */
export async function queryRevenueByMonth(
  supabase: SupabaseClient,
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<Array<{ month: string; revenue: number }>> {
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

  // Aggregate by month key (YYYY-MM in Eastern time)
  const revenueByMonth = new Map<string, number>();
  for (const r of results) {
    if (!r.snapshot) continue;
    const monthKey = toEasternMonthKey(r.campaign.send_time);
    const current = revenueByMonth.get(monthKey) ?? 0;
    revenueByMonth.set(
      monthKey,
      current + (r.snapshot.conversion_value ?? 0)
    );
  }

  // Sort by month key and return
  return Array.from(revenueByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));
}
