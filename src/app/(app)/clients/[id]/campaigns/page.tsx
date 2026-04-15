import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, parseISO, startOfDay, addDays, subDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { SortHeader } from "../_components/sort-header";
import {
  fmtDate,
  fmtCount,
  fmtPct,
  fmtPct2,
  fmtPct4,
  fmtCurrency,
  fmtRpr,
  fmtText,
  fmtDayAbbr,
  computeOrdersPerRecipient,
  computeOrdersPerClick,
} from "../_components/format";

const TIMEZONE = "America/New_York";

// Columns sortable via Supabase .order() — direct view columns
const SQL_SORTABLE = new Set([
  "send_time",
  "campaign_name",
  "recipient_count",
  "open_rate",
  "click_rate",
  "conversion_count",
  "conversion_value",
  "revenue_per_recipient",
  "conversion_rate",
]);

// Columns sorted in TypeScript after fetch (computed, not in view)
const COMPUTED_SORTABLE = new Set([
  "day_of_week",
  "orders_per_recipient",
  "orders_per_click",
]);

const ALL_SORTABLE = new Set([...SQL_SORTABLE, ...COMPUTED_SORTABLE]);

const DEFAULT_SORT = "send_time";
const DEFAULT_DIR = "desc";

// ── Day-of-week sort helper ──────────────────
// Returns 0=Sun … 6=Sat in Eastern time, or -1 for null
const DOW_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayOfWeekET(sendTime: string | null | undefined): number {
  if (!sendTime) return -1;
  const d = new Date(sendTime);
  if (isNaN(d.getTime())) return -1;
  const abbr = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(d);
  return DOW_ORDER.indexOf(abbr);
}

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; dir?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, last_synced_at")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // ── Sort params ──────────────────────────────
  const sortCol = sp.sort && ALL_SORTABLE.has(sp.sort) ? sp.sort : DEFAULT_SORT;
  const sortDir = sp.dir === "asc" ? "asc" : DEFAULT_DIR;

  // ── Date filter — Eastern timezone ──────────
  const nowEastern = toZonedTime(new Date(), TIMEZONE);
  const defaultToStr = format(nowEastern, "yyyy-MM-dd");
  const defaultFromStr = format(subDays(nowEastern, 90), "yyyy-MM-dd");

  const fromStr = sp.from ?? defaultFromStr;
  const toStr = sp.to ?? defaultToStr;

  // Convert Eastern-local date strings to UTC bounds for SQL
  // fromZonedTime interprets the input as a time in TIMEZONE and converts to UTC
  const fromUtc = fromZonedTime(startOfDay(parseISO(fromStr)), TIMEZONE);
  const toUtc = fromZonedTime(startOfDay(addDays(parseISO(toStr), 1)), TIMEZONE); // exclusive upper bound

  // Extra params to thread through sort links
  const dateParams: Record<string, string> = {};
  if (sp.from) dateParams.from = sp.from;
  if (sp.to) dateParams.to = sp.to;

  // ── Query ────────────────────────────────────
  let query = supabase
    .from("campaigns_latest")
    .select("*", { count: "exact" })
    .eq("client_id", id)
    .gte("send_time", fromUtc.toISOString())
    .lt("send_time", toUtc.toISOString());

  // SQL sort for native columns only
  if (SQL_SORTABLE.has(sortCol)) {
    query = query.order(sortCol, { ascending: sortDir === "asc", nullsFirst: false });
  }

  const { data: rawCampaigns, count } = await query;

  // TypeScript sort for computed columns
  let campaigns = rawCampaigns ?? [];
  if (COMPUTED_SORTABLE.has(sortCol) && campaigns.length > 0) {
    campaigns = [...campaigns].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (sortCol === "day_of_week") {
        aVal = dayOfWeekET(a.send_time);
        bVal = dayOfWeekET(b.send_time);
      } else if (sortCol === "orders_per_recipient") {
        aVal = computeOrdersPerRecipient(a.conversion_count, a.recipient_count) ?? -1;
        bVal = computeOrdersPerRecipient(b.conversion_count, b.recipient_count) ?? -1;
      } else {
        // orders_per_click
        aVal = computeOrdersPerClick(a.conversion_count, a.clicks_unique) ?? -1;
        bVal = computeOrdersPerClick(b.conversion_count, b.clicks_unique) ?? -1;
      }

      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  const basePath = `/clients/${id}/campaigns`;
  const lastSynced = client.last_synced_at
    ? formatDistanceToNow(new Date(client.last_synced_at), { addSuffix: true })
    : null;

  // Format dates for subtitle and form display
  const fromDisplay = format(parseISO(fromStr), "MMM d, yyyy");
  const toDisplay = format(parseISO(toStr), "MMM d, yyyy");

  const clearHref = basePath; // drops all filter + sort params, restores defaults

  const sharedSortProps = {
    currentSort: sortCol,
    currentDir: sortDir as "asc" | "desc",
    basePath,
    extraParams: dateParams,
  };

  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`${count ?? 0} campaign${(count ?? 0) !== 1 ? "s" : ""} · ${fromDisplay} – ${toDisplay}${lastSynced ? ` · Last synced ${lastSynced}` : ""}`}
      />

      {/* ── Date range filter ── */}
      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="from" className="text-[12px] font-medium text-taupe-dark">
            From:
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={fromStr}
            className="rounded border border-taupe-light bg-white px-2 py-1 text-[13px] text-charcoal focus:outline-none focus:ring-1 focus:ring-taupe"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="to" className="text-[12px] font-medium text-taupe-dark">
            To:
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={toStr}
            className="rounded border border-taupe-light bg-white px-2 py-1 text-[13px] text-charcoal focus:outline-none focus:ring-1 focus:ring-taupe"
          />
        </div>
        {/* Preserve current sort when applying filter */}
        <input type="hidden" name="sort" value={sortCol} />
        <input type="hidden" name="dir" value={sortDir} />
        <button
          type="submit"
          className="rounded bg-charcoal px-3 py-1.5 text-[12px] font-medium text-ivory hover:bg-charcoal-light transition-colors"
        >
          Apply
        </button>
        <Link
          href={clearHref}
          className="rounded border border-taupe-light bg-white px-3 py-1.5 text-[12px] font-medium text-taupe-dark hover:text-charcoal transition-colors"
        >
          Clear
        </Link>
      </form>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-taupe-light bg-white/60 px-6 py-12 text-center">
          <p className="text-sm text-taupe-dark">
            No campaigns in this date range.{" "}
            <Link href={clearHref} className="underline hover:text-charcoal">
              Clear filter
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe-light bg-white/60">
          <table className="w-full text-sm">
            <thead className="border-b border-taupe-light bg-white/80">
              <tr>
                <SortHeader label="Send date" column="send_time" {...sharedSortProps} />
                <SortHeader label="Day" column="day_of_week" {...sharedSortProps} />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Ch</th>
                <SortHeader label="Campaign name" column="campaign_name" {...sharedSortProps} />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Subject</th>
                <SortHeader label="Recipients" column="recipient_count" {...sharedSortProps} className="text-right" />
                <SortHeader label="Open %" column="open_rate" {...sharedSortProps} className="text-right" />
                <SortHeader label="Click %" column="click_rate" {...sharedSortProps} className="text-right" />
                <SortHeader label="Conv." column="conversion_count" {...sharedSortProps} className="text-right" />
                <SortHeader label="Conv rate" column="conversion_rate" {...sharedSortProps} className="text-right" />
                <SortHeader label="Ord/Recip" column="orders_per_recipient" {...sharedSortProps} className="text-right" title="Orders per recipient" />
                <SortHeader label="Ord/Click" column="orders_per_click" {...sharedSortProps} className="text-right" title="Orders per click" />
                <SortHeader label="Revenue" column="conversion_value" {...sharedSortProps} className="text-right" />
                <SortHeader label="RPR" column="revenue_per_recipient" {...sharedSortProps} className="text-right" title="Revenue per recipient" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe-light/60">
              {campaigns.map((c) => {
                const name = fmtText(c.campaign_name, 50);
                const subject = fmtText(c.subject_line, 60);
                const opr = computeOrdersPerRecipient(c.conversion_count, c.recipient_count);
                const opc = computeOrdersPerClick(c.conversion_count, c.clicks_unique);
                return (
                  <tr key={c.id} className="hover:bg-taupe-light/30 transition-colors">
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] text-charcoal">
                      {fmtDate(c.send_time)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] text-charcoal">
                      {fmtDayAbbr(c.send_time)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        c.channel === "sms"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-taupe-light text-taupe-dark"
                      }`}>
                        {c.channel ?? "\u2014"}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-[13px] text-charcoal">
                      <Link
                        href={`/clients/${id}/campaigns/${c.id}`}
                        className="hover:underline"
                        title={name.full ?? undefined}
                      >
                        {name.display}
                      </Link>
                      {c.figma_url && (
                        <span className="ml-1.5 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-purple-700">
                          Figma
                        </span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-[13px] text-taupe-dark" title={subject.full ?? undefined}>
                      {subject.display}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtCount(c.recipient_count)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct(c.open_rate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct(c.click_rate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtCount(c.conversion_count)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct2(c.conversion_rate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct4(opr)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct2(opc)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtCurrency(c.conversion_value)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtRpr(c.revenue_per_recipient)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        c.status === "sent"
                          ? "bg-green-50 text-green-700"
                          : c.status === "draft"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-taupe-light text-taupe-dark"
                      }`}>
                        {c.status ?? "\u2014"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
