/**
 * Commission calculator type definitions.
 *
 * These interfaces define the contract between the calculator (pure computation)
 * and the writer (database persistence). The calculator produces a ComputeOutput;
 * the writer consumes it.
 */

// ── Calculator input ───────────────────────────

export interface ComputeInput {
  /** Internal client UUID */
  clientId: string;

  /** Billing period start (inclusive), calendar date in YYYY-MM-DD */
  periodStart: string;

  /** Billing period end (inclusive), calendar date in YYYY-MM-DD */
  periodEnd: string;

  /** Override default commission rate (0.20). Optional — defaults from config.ts */
  commissionRate?: number;

  /** Override default daily campaign threshold ($500). Optional */
  dailyCampaignThreshold?: number;

  /** Override default daily combined threshold ($1000). Optional */
  dailyCombinedThreshold?: number;

  /** Override default credits target (100). Optional */
  creditsTarget?: number;
}

// ── Calculator output ──────────────────────────

export interface ComputeOutput {
  statement: StatementDraft;
  creditDays: CreditDayRow[];
  diagnostics: ComputeDiagnostics;
}

export interface StatementDraft {
  clientId: string;
  periodStart: string;
  periodEnd: string;

  /** Total campaign conversion_value in the period */
  campaignsRevenue: number;

  /** Total flow conversion_value (approximate — v1 proration) */
  flowsRevenue: number;

  /** Commission rate applied (e.g. 0.20) */
  commissionRate: number;

  /** campaigns_revenue * commission_rate, rounded to 2 decimals */
  commissionAmount: number;

  /** Number of days in the period that passed the credit test */
  creditsEarned: number;

  /** Target number of credits for the period */
  creditsTarget: number;

  /** Threshold: daily campaign revenue to earn a credit via campaign-only test */
  dailyCampaignThreshold: number;

  /** Threshold: daily combined revenue to earn a credit via combined test */
  dailyCombinedThreshold: number;

  /** Always 'draft' from the calculator */
  status: "draft";
}

export interface CreditDayRow {
  /** Calendar date in YYYY-MM-DD (Eastern time) */
  day: string;

  /** Campaign conversion_value attributed to this day */
  campaignsRevenue: number;

  /** Flow revenue allocated to this day (uniform proration in v1) */
  flowsRevenueAllocated: number;

  /** campaignsRevenue + flowsRevenueAllocated */
  totalRevenue: number;

  /** Whether daily campaign revenue >= daily_campaign_threshold */
  passedCampaignThreshold: boolean;

  /** Whether daily total revenue >= daily_combined_threshold */
  passedCombinedThreshold: boolean;

  /** Whether this day earned a credit (passed_campaign OR passed_combined) */
  creditEarned: boolean;
}

export interface ComputeDiagnostics {
  /** Campaigns in period with sendTime but no incremental snapshot */
  campaignsMissingSnapshots: number;

  /** Flows for client with no incremental snapshot */
  flowsMissingSnapshots: number;

  /** Total campaigns considered (had sendTime in period) */
  campaignsConsidered: number;

  /** Total flows for client */
  flowsConsidered: number;
}

// ── Writer types ───────────────────────────────

export interface SaveStatementOptions {
  /**
   * If true, overwrites an existing draft statement for the same period.
   * If false (default), throws on conflict with an existing draft.
   * Always throws if existing statement is approved/invoiced/paid.
   */
  overwriteDraft?: boolean;
}

export interface SavedStatement {
  /** Database UUID of the saved commission_statements row */
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  campaignsRevenue: number;
  flowsRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  creditsEarned: number;
  creditsTarget: number;
  status: string;
  generatedAt: string;
}
