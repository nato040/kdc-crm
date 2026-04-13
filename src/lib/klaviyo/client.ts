/**
 * Klaviyo API client — GET-only read surface.
 *
 * This module is the single point of contact with the Klaviyo API.
 * Nothing outside src/lib/klaviyo/ calls fetch against any Klaviyo URL.
 *
 * Endpoints (exhaustive list — this module makes no other Klaviyo API calls):
 *   1. GET  /api/campaigns               — list campaigns (email + SMS, merged)
 *   2. POST /api/campaign-values-reports — campaign engagement report (read-only query)
 *   3. GET  /api/flows                   — list flows
 *   4. POST /api/flow-values-reports     — flow engagement report (read-only query)
 *   5. GET  /api/metrics                 — list account metrics
 *
 * The two POST endpoints are read-only reporting queries that Klaviyo requires
 * as POST because the query body is too complex for query string parameters.
 * They require read-only API scopes only.
 *
 * Exported functions are named per-endpoint. No generic request helper is exported.
 * No function accepts an HTTP method as a parameter. The internal fetch helper
 * hardcodes GET or POST per endpoint — a future edit cannot accidentally create
 * a write path without deliberately modifying this source file.
 *
 * API key is never included in error messages, logs, or stack traces.
 */

import {
  KlaviyoAuthError,
  KlaviyoClientError,
  KlaviyoPaginationLimitError,
  KlaviyoRateLimitError,
  KlaviyoServerError,
} from "./errors";
import type {
  KlaviyoCampaign,
  KlaviyoFlow,
  KlaviyoJsonApiResource,
  KlaviyoJsonApiResponse,
  KlaviyoMetric,
  KlaviyoStats,
  KlaviyoValuesReportResponse,
  KlaviyoValuesReportResult,
} from "./types";

// ── Constants ───────────────────────────────

const BASE_URL = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";
const MAX_RETRIES = 3;
// 429s get a larger retry budget than 5xx/network errors — rate limits are
// known-recoverable with the right wait, other errors past 3 attempts usually
// indicate something actually broken.
const MAX_RETRIES_RATE_LIMIT = 5;
const DEFAULT_MAX_PAGES = 100;
const REPORT_MAX_PAGES = 500;
const REPORT_MAX_TIMEFRAME_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REPORT_INTER_CALL_DELAY_MS = 750;

// Statistics requested from values-report endpoints.
const REPORT_STATISTICS = [
  "recipients",
  "delivered",
  "opens_unique",
  "clicks_unique",
  "open_rate",
  "click_rate",
  "bounce_rate",
  "unsubscribe_rate",
  "conversions",
  "conversion_value",
  "conversion_rate",
  "revenue_per_recipient",
  "average_order_value",
];

// ── Private: Headers ────────────────────────

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: REVISION,
    accept: "application/vnd.api+json",
    "content-type": "application/vnd.api+json",
  };
}

// ── Private: HTTP layer ─────────────────────

/**
 * Single point for all HTTP calls. Handles auth headers, retries,
 * backoff, and debug logging. API key is passed per-call and never
 * stored as module state.
 */
async function fetchKlaviyo(
  apiKey: string,
  method: "GET" | "POST",
  url: string,
  body?: object
): Promise<Response> {
  const headers = buildHeaders(apiKey);
  const startTime = Date.now();
  let lastError: Error | null = null;

  // Loop bound is the larger retry budget (rate limit). Non-429 paths
  // check their own cap (MAX_RETRIES) and throw before reaching this limit.
  for (let attempt = 1; attempt <= MAX_RETRIES_RATE_LIMIT; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const duration = Date.now() - startTime;
      const shortUrl = url.replace(BASE_URL, "");

      if (response.ok) {
        console.debug(
          `[klaviyo] ${method} ${shortUrl} → ${response.status} (${duration}ms)`
        );
        return response;
      }

      // 401/403 — auth error, no retry
      if (response.status === 401 || response.status === 403) {
        console.debug(
          `[klaviyo] ${method} ${shortUrl} → ${response.status} (${duration}ms) — auth error`
        );
        throw new KlaviyoAuthError(response.status);
      }

      // 429 — rate limited, respect Retry-After (uses larger retry budget)
      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") ?? "5",
          10
        );
        const jitter = Math.random() * 500;
        const waitMs = retryAfter * 1000 + jitter;

        console.debug(
          `[klaviyo] ${method} ${shortUrl} → 429 (${duration}ms) — retrying in ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt}/${MAX_RETRIES_RATE_LIMIT})`
        );

        if (attempt === MAX_RETRIES_RATE_LIMIT) {
          throw new KlaviyoRateLimitError(retryAfter);
        }

        await sleep(waitMs);
        continue;
      }

      // 5xx — server error, exponential backoff with jitter
      if (response.status >= 500) {
        const backoff = Math.pow(2, attempt - 1) * 500;
        const jitter = Math.random() * 500;
        const waitMs = Math.min(backoff + jitter, 30000);

        console.debug(
          `[klaviyo] ${method} ${shortUrl} → ${response.status} (${duration}ms) — retrying in ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt}/${MAX_RETRIES})`
        );

        if (attempt === MAX_RETRIES) {
          throw new KlaviyoServerError(response.status);
        }

        await sleep(waitMs);
        continue;
      }

      // Other 4xx — client error, no retry (bug in our code)
      let detail: string | undefined;
      try {
        const errBody = await response.json();
        detail =
          errBody?.errors?.[0]?.detail ??
          errBody?.errors?.[0]?.title ??
          undefined;
      } catch {
        // ignore parse failure
      }
      console.debug(
        `[klaviyo] ${method} ${shortUrl} → ${response.status} (${duration}ms) — client error${detail ? `: ${detail}` : ""}`
      );
      throw new KlaviyoClientError(response.status, detail);
    } catch (error) {
      // Re-throw Klaviyo errors as-is
      if (
        error instanceof KlaviyoAuthError ||
        error instanceof KlaviyoRateLimitError ||
        error instanceof KlaviyoServerError ||
        error instanceof KlaviyoClientError
      ) {
        throw error;
      }

      // Network error or other — treat like 5xx, retry with backoff
      lastError = error as Error;
      if (attempt === MAX_RETRIES) {
        throw new KlaviyoServerError(0);
      }

      const backoff = Math.pow(2, attempt - 1) * 500;
      const jitter = Math.random() * 500;
      await sleep(Math.min(backoff + jitter, 30000));
    }
  }

  throw lastError ?? new KlaviyoServerError(0);
}

// ── Private: Pagination ─────────────────────

/**
 * Follow links.next until null. Accumulates all resources + included.
 * Throws KlaviyoPaginationLimitError if maxPages is exceeded.
 */
async function fetchAllPages<T extends KlaviyoJsonApiResource>(
  apiKey: string,
  initialUrl: string,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<{ resources: T[]; included: KlaviyoJsonApiResource[] }> {
  const resources: T[] = [];
  const included: KlaviyoJsonApiResource[] = [];
  let url: string | null = initialUrl;
  let pageCount = 0;

  while (url) {
    pageCount++;
    if (pageCount > maxPages) {
      const shortUrl = initialUrl.replace(BASE_URL, "");
      throw new KlaviyoPaginationLimitError(shortUrl, pageCount, maxPages);
    }

    const response = await fetchKlaviyo(apiKey, "GET", url);
    const json = (await response.json()) as KlaviyoJsonApiResponse<T>;

    const data = Array.isArray(json.data) ? json.data : [json.data];
    resources.push(...data);

    if (json.included) {
      included.push(...json.included);
    }

    url = json.links?.next ?? null;
  }

  return { resources, included };
}

/**
 * Fetch values report (POST — read-only reporting query).
 * Paginates via page_cursor if needed.
 * Throws KlaviyoPaginationLimitError if maxPages is exceeded.
 */
async function fetchValuesReport(
  apiKey: string,
  reportType: string,
  attributes: Record<string, unknown>,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<KlaviyoValuesReportResult[]> {
  const results: KlaviyoValuesReportResult[] = [];
  let pageCursor: string | null = null;
  let isFirstRequest = true;
  let pageCount = 0;

  while (isFirstRequest || pageCursor) {
    isFirstRequest = false;
    pageCount++;

    if (pageCount > maxPages) {
      throw new KlaviyoPaginationLimitError(
        `/${reportType.replace("report", "reports")}`,
        pageCount,
        maxPages
      );
    }

    let url = `${BASE_URL}/${reportType.replace("report", "reports")}`;
    if (pageCursor) {
      url += `?page_cursor=${encodeURIComponent(pageCursor)}`;
    }

    const response = await fetchKlaviyo(apiKey, "POST", url, {
      data: {
        type: reportType,
        attributes,
      },
    });

    const json = (await response.json()) as KlaviyoValuesReportResponse;
    results.push(...(json.data?.attributes?.results ?? []));

    // Extract page cursor from links.next URL if present
    const nextUrl = json.links?.next ?? null;
    if (nextUrl) {
      const nextUrlObj = new URL(nextUrl);
      pageCursor = nextUrlObj.searchParams.get("page_cursor");
    } else {
      pageCursor = null;
    }
  }

  return results;
}

// ── Private: Time chunking ──────────────────

/**
 * Build an array of (start, end) date pairs that cover the full range
 * in segments of at most maxDays each, working backwards from endDate.
 * Last chunk's start is clamped to startDate.
 */
function buildTimeChunks(
  startDate: Date,
  endDate: Date,
  maxDays: number = REPORT_MAX_TIMEFRAME_DAYS
): Array<{ start: Date; end: Date }> {
  const chunks: Array<{ start: Date; end: Date }> = [];
  let chunkEnd = endDate;

  while (chunkEnd.getTime() > startDate.getTime()) {
    const chunkStart = new Date(
      Math.max(chunkEnd.getTime() - maxDays * MS_PER_DAY, startDate.getTime())
    );
    chunks.push({ start: chunkStart, end: chunkEnd });
    chunkEnd = chunkStart;
  }

  return chunks;
}

/**
 * Fetch a values report for a list of entity IDs, handling both the
 * 100-item contains-any batching and pagination. Returns raw results
 * for aggregation by the caller.
 */
async function fetchBatchedReport(
  apiKey: string,
  reportType: "campaign-values-report" | "flow-values-report",
  entityIds: string[],
  filterKey: "campaign_id" | "flow_id",
  groupBy: string[],
  conversionMetricId: string,
  startDate: Date,
  endDate: Date
): Promise<KlaviyoValuesReportResult[]> {
  const BATCH_SIZE = 100;
  const allResults: KlaviyoValuesReportResult[] = [];

  for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
    // Deliberate pacing to stay under Klaviyo's sustained rate limit on
    // report endpoints. Sequential by design — do not parallelize.
    if (i > 0) {
      await sleep(REPORT_INTER_CALL_DELAY_MS);
    }

    const batch = entityIds.slice(i, i + BATCH_SIZE);
    const results = await fetchValuesReport(
      apiKey,
      reportType,
      {
        statistics: REPORT_STATISTICS,
        timeframe: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        conversion_metric_id: conversionMetricId,
        filter: `contains-any(${filterKey},${JSON.stringify(batch)})`,
        group_by: groupBy,
      },
      REPORT_MAX_PAGES
    );
    allResults.push(...results);
  }

  return allResults;
}

// ── Private: Parsers ────────────────────────

function parseCampaign(
  resource: KlaviyoJsonApiResource,
  included: KlaviyoJsonApiResource[]
): KlaviyoCampaign {
  const attrs = resource.attributes;

  // Find the campaign-message for subject/preview/from fields
  const messageRel = resource.relationships?.["campaign-messages"];
  const messageIds = messageRel?.data
    ? (Array.isArray(messageRel.data) ? messageRel.data : [messageRel.data])
    : [];
  const messageResource =
    messageIds.length > 0
      ? included.find(
          (inc) =>
            inc.type === "campaign-message" && inc.id === messageIds[0].id
        )
      : undefined;

  const msgAttrs =
    messageResource?.attributes ?? ({} as Record<string, unknown>);
  const defn = (msgAttrs as Record<string, unknown>).definition as
    | Record<string, unknown>
    | undefined;
  const content = (
    (msgAttrs as Record<string, unknown>).content ??
    defn?.content ??
    {}
  ) as Record<string, unknown>;
  const definition = (defn ?? {}) as Record<string, unknown>;

  // Channel comes from the message definition
  const channel =
    (definition.channel as string) ??
    (content.channel as string) ??
    "email";

  // Send time from send_strategy
  const sendStrategy = attrs.send_strategy as
    | { options_static?: { datetime?: string } }
    | undefined;
  const sendTime = sendStrategy?.options_static?.datetime ?? null;

  return {
    id: resource.id,
    channel: channel === "sms" ? "sms" : "email",
    name: (attrs.name as string) ?? "",
    status: (attrs.status as string) ?? "",
    archived: (attrs.archived as boolean) ?? false,
    sendTime,
    subjectLine: (content.subject as string) ?? null,
    previewText: (content.preview_text as string) ?? null,
    fromEmail: (content.from_email as string) ?? null,
    fromLabel: (content.from_label as string) ?? null,
  };
}

function parseFlow(resource: KlaviyoJsonApiResource): KlaviyoFlow {
  const attrs = resource.attributes;
  return {
    id: resource.id,
    name: (attrs.name as string) ?? "",
    status: (attrs.status as string) ?? "",
    triggerType: (attrs.trigger_type as string) ?? "",
    archived: (attrs.archived as boolean) ?? false,
    created: (attrs.created as string) ?? "",
    updated: (attrs.updated as string) ?? "",
  };
}

// ── Private: Report aggregation ─────────────

/**
 * Maps values-report results to a Map keyed by the specified grouping field.
 * When aggregate is true, sums message-level stats up to campaign/flow level
 * and recalculates derived rates.
 *
 * Aggregation is needed because Klaviyo requires group_by to include
 * campaign_message_id / flow_message_id — one row per message, not per
 * campaign/flow. We sum counts and recalculate rates to get per-entity totals.
 */
function mapReportResults(
  results: KlaviyoValuesReportResult[],
  groupKey: string,
  aggregate: boolean = false
): Map<string, KlaviyoStats> {
  const map = new Map<string, KlaviyoStats>();

  for (const result of results) {
    const id = result.groupings[groupKey];
    if (!id) continue;

    const s = result.statistics;
    const incoming: KlaviyoStats = {
      recipients: s.recipients ?? null,
      delivered: s.delivered ?? null,
      opensUnique: s.opens_unique ?? null,
      clicksUnique: s.clicks_unique ?? null,
      openRate: s.open_rate ?? null,
      clickRate: s.click_rate ?? null,
      bounceRate: s.bounce_rate ?? null,
      unsubscribeRate: s.unsubscribe_rate ?? null,
      conversions: s.conversions ?? null,
      conversionValue: s.conversion_value ?? null,
      conversionRate: s.conversion_rate ?? null,
      revenuePerRecipient: s.revenue_per_recipient ?? null,
      averageOrderValue: s.average_order_value ?? null,
    };

    if (!aggregate || !map.has(id)) {
      map.set(id, incoming);
    } else {
      // Aggregate: sum counts, recalculate rates after all rows processed
      const existing = map.get(id)!;
      map.set(id, {
        recipients: addNullable(existing.recipients, incoming.recipients),
        delivered: addNullable(existing.delivered, incoming.delivered),
        opensUnique: addNullable(existing.opensUnique, incoming.opensUnique),
        clicksUnique: addNullable(
          existing.clicksUnique,
          incoming.clicksUnique
        ),
        conversions: addNullable(existing.conversions, incoming.conversions),
        conversionValue: addNullable(
          existing.conversionValue,
          incoming.conversionValue
        ),
        // Rates will be recalculated below.
        // Bounce and unsubscribe rates are null when aggregating across chunks —
        // Klaviyo returns rates only, not raw counts, so they can't be recomputed.
        // Single-chunk calls (≤365 days) pass Klaviyo's native values through.
        openRate: null,
        clickRate: null,
        bounceRate: null,
        unsubscribeRate: null,
        conversionRate: null,
        revenuePerRecipient: null,
        averageOrderValue: null,
      });
    }
  }

  // Recalculate rates for aggregated entries
  if (aggregate) {
    for (const [, stats] of map) {
      if (stats.recipients && stats.recipients > 0) {
        if (stats.opensUnique != null)
          stats.openRate = stats.opensUnique / stats.recipients;
        if (stats.clicksUnique != null)
          stats.clickRate = stats.clicksUnique / stats.recipients;
        if (stats.conversions != null)
          stats.conversionRate = stats.conversions / stats.recipients;
        if (stats.conversionValue != null)
          stats.revenuePerRecipient =
            stats.conversionValue / stats.recipients;
      }
      if (
        stats.conversions &&
        stats.conversions > 0 &&
        stats.conversionValue != null
      ) {
        stats.averageOrderValue = stats.conversionValue / stats.conversions;
      }
    }
  }

  return map;
}

// ── Private: Helpers ────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

// ── Exported functions ──────────────────────

/**
 * Fetch all campaigns, optionally filtered by date.
 *
 * Two sequential calls: email then SMS, merged and deduped by ID.
 *
 * Incremental mode: pass `since` date. Filters by `updated_at`, not `send_time`,
 * because Klaviyo does not permit filtering on `send_time`. Caller must pass
 * `since = (last_synced_at - 7 days)` to compensate for both `updated_at`
 * semantics (which catch modifications, not just sends) and late conversion
 * attribution overlap.
 *
 * Backfill mode: omit `since` to fetch all campaigns with no date filter.
 */
export async function getCampaigns(
  apiKey: string,
  since?: Date
): Promise<KlaviyoCampaign[]> {
  // Klaviyo requires messages.channel filter — two calls, email then SMS
  const emailFilter = since
    ? // updated_at used because Klaviyo does not support filtering on send_time
      `and(equals(messages.channel,'email'),greater-or-equal(updated_at,${since.toISOString().split("T")[0]}T00:00:00Z))`
    : `equals(messages.channel,'email')`;
  const smsFilter = since
    ? `and(equals(messages.channel,'sms'),greater-or-equal(updated_at,${since.toISOString().split("T")[0]}T00:00:00Z))`
    : `equals(messages.channel,'sms')`;

  const emailCampaigns = await fetchAllPages<KlaviyoJsonApiResource>(
    apiKey,
    `${BASE_URL}/campaigns?filter=${emailFilter}&include=campaign-messages`
  );
  const smsCampaigns = await fetchAllPages<KlaviyoJsonApiResource>(
    apiKey,
    `${BASE_URL}/campaigns?filter=${smsFilter}&include=campaign-messages`
  );

  // Dedupe by ID (shouldn't overlap, but defensive)
  const seen = new Set<string>();
  const all: KlaviyoJsonApiResource[] = [];
  const allIncluded: KlaviyoJsonApiResource[] = [];

  for (const { resources, included } of [
    {
      resources: emailCampaigns.resources,
      included: emailCampaigns.included,
    },
    { resources: smsCampaigns.resources, included: smsCampaigns.included },
  ]) {
    for (const r of resources) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        all.push(r);
      }
    }
    allIncluded.push(...included);
  }

  return all.map((r) => parseCampaign(r, allIncluded));
}

/**
 * Query campaign engagement + conversion stats.
 * Returns Map keyed by Klaviyo campaign ID.
 *
 * Batches campaign IDs into chunks of 100 because Klaviyo limits
 * contains-any filters to 100 items per request.
 *
 * Groups by campaign_id + campaign_message_id because Klaviyo requires
 * campaign_message_id in group_by. Aggregates message-level stats up
 * to campaign level before returning.
 */
export async function getCampaignValuesReport(
  apiKey: string,
  campaignIds: string[],
  conversionMetricId: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, KlaviyoStats>> {
  if (campaignIds.length === 0) return new Map();

  // Klaviyo's values-report endpoints reject timeframes >1 year. Chunked into
  // ≤365-day segments and merged via mapReportResults — counts sum, rates
  // recompute from summed counts.
  const chunks = buildTimeChunks(startDate, endDate);
  const allResults: KlaviyoValuesReportResult[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    // Inter-chunk pacing — same rationale as the inter-batch pacing in
    // fetchBatchedReport.
    if (ci > 0) {
      await sleep(REPORT_INTER_CALL_DELAY_MS);
    }

    const chunk = chunks[ci];
    const chunkResults = await fetchBatchedReport(
      apiKey,
      "campaign-values-report",
      campaignIds,
      "campaign_id",
      // campaign_message_id required by Klaviyo — cannot group by campaign_id alone
      ["campaign_id", "campaign_message_id"],
      conversionMetricId,
      chunk.start,
      chunk.end
    );
    allResults.push(...chunkResults);
  }

  // Aggregate across campaign_message_id and time chunks to get per-campaign totals
  return mapReportResults(allResults, "campaign_id", true);
}

/**
 * Fetch all flows in the account.
 */
export async function getFlows(apiKey: string): Promise<KlaviyoFlow[]> {
  const { resources } = await fetchAllPages<KlaviyoJsonApiResource>(
    apiKey,
    `${BASE_URL}/flows`
  );
  return resources.map((r) => parseFlow(r));
}

/**
 * Query flow engagement + conversion stats.
 * Returns Map keyed by Klaviyo flow ID.
 *
 * Batches flow IDs into chunks of 100 because Klaviyo limits
 * contains-any filters to 100 items per request.
 *
 * Groups by flow_id + flow_message_id because Klaviyo requires
 * flow_message_id in group_by. Aggregates message-level stats up
 * to flow level before returning.
 */
export async function getFlowValuesReport(
  apiKey: string,
  flowIds: string[],
  conversionMetricId: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, KlaviyoStats>> {
  if (flowIds.length === 0) return new Map();

  // Klaviyo's values-report endpoints reject timeframes >1 year. Chunked into
  // ≤365-day segments and merged via mapReportResults — counts sum, rates
  // recompute from summed counts.
  const chunks = buildTimeChunks(startDate, endDate);
  const allResults: KlaviyoValuesReportResult[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    // Inter-chunk pacing — same rationale as the inter-batch pacing in
    // fetchBatchedReport.
    if (ci > 0) {
      await sleep(REPORT_INTER_CALL_DELAY_MS);
    }

    const chunk = chunks[ci];
    const chunkResults = await fetchBatchedReport(
      apiKey,
      "flow-values-report",
      flowIds,
      "flow_id",
      // flow_message_id required by Klaviyo — cannot group by flow_id alone
      ["flow_id", "flow_message_id"],
      conversionMetricId,
      chunk.start,
      chunk.end
    );
    allResults.push(...chunkResults);
  }

  // Aggregate across flow_message_id and time chunks to get per-flow totals
  return mapReportResults(allResults, "flow_id", true);
}

/**
 * Fetch all metrics. Caller filters for "Placed Order" by name to
 * resolve the account-specific metric ID (no stable global ID exists).
 */
export async function getMetrics(apiKey: string): Promise<KlaviyoMetric[]> {
  const { resources } = await fetchAllPages<KlaviyoJsonApiResource>(
    apiKey,
    `${BASE_URL}/metrics`
  );
  return resources.map((r) => ({
    id: r.id,
    name: (r.attributes.name as string) ?? "",
  }));
}
