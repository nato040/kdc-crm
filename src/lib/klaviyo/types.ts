/**
 * Klaviyo API response types.
 * Mapped from Klaviyo's JSON:API format to flat internal types.
 */

// ── Campaign ────────────────────────────────

export interface KlaviyoCampaign {
  id: string;
  channel: "email" | "sms";
  name: string;
  status: string;
  archived: boolean;
  sendTime: string | null;
  subjectLine: string | null;
  previewText: string | null;
  fromEmail: string | null;
  fromLabel: string | null;
}

// ── Flow ────────────────────────────────────

export interface KlaviyoFlow {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  archived: boolean;
  created: string;
  updated: string;
}

// ── Metric ──────────────────────────────────

export interface KlaviyoMetric {
  id: string;
  name: string;
}

// ── Values report stats ─────────────────────

export interface KlaviyoStats {
  recipients: number | null;
  delivered: number | null;
  opensUnique: number | null;
  clicksUnique: number | null;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
  unsubscribeRate: number | null;
  conversions: number | null;
  conversionValue: number | null;
  conversionRate: number | null;
  revenuePerRecipient: number | null;
  averageOrderValue: number | null;
}

// ── Raw Klaviyo JSON:API shapes ─────────────
// Used internally by client.ts for parsing responses.

export interface KlaviyoJsonApiResponse<T = KlaviyoJsonApiResource> {
  data: T[] | T;
  included?: KlaviyoJsonApiResource[];
  links?: { next?: string | null };
}

export interface KlaviyoJsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<
    string,
    { data: { type: string; id: string } | { type: string; id: string }[] }
  >;
}

export interface KlaviyoValuesReportResponse {
  data: {
    type: string;
    attributes: {
      results: KlaviyoValuesReportResult[];
    };
  };
  links?: { next?: string | null };
}

export interface KlaviyoValuesReportResult {
  groupings: Record<string, string>;
  statistics: Record<string, number>;
}
