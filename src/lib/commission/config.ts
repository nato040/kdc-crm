/**
 * Commission calculation defaults.
 *
 * These values match 90degree by reflex's current contract and
 * Cody's existing spreadsheet rules. Overridable per computation
 * via the optional fields on ComputeInput — the constants are the
 * fallback when no override is provided.
 *
 * Timezone is hardcoded to America/New_York because Cody is
 * NYC-based. When a future client operates in a different zone,
 * this becomes a per-client field and this constant becomes the
 * fallback for un-configured clients.
 */

/** Flat percentage of campaign revenue paid as commission (20%) */
export const COMMISSION_RATE = 0.2 as const;

/** Minimum daily campaign revenue ($) to pass the campaign-only credit test */
export const DAILY_CAMPAIGN_THRESHOLD = 500 as const;

/** Minimum daily combined (campaign + flow) revenue ($) to pass the combined credit test */
export const DAILY_COMBINED_THRESHOLD = 1000 as const;

/** Target number of credit-earning days per billing period */
export const CREDITS_TARGET = 100 as const;

/** IANA timezone for calendar-day truncation of campaign send times */
export const TIMEZONE = "America/New_York" as const;
