import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  queryPeriodSummary,
  queryPeriodCampaigns,
  type PeriodSummary,
  type PeriodCampaign,
} from "@/lib/finance/period-analysis";

const TIMEZONE = "America/New_York";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFmtWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const deltaCurrencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: "always",
});

const numberFmt = new Intl.NumberFormat("en-US");

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtRpr(value: number): string {
  return `$${value.toFixed(4)}`;
}

function pctChange(a: number, b: number): number | null {
  if (a === 0) return null;
  return ((b - a) / a) * 100;
}

function deltaColor(delta: number | null): string {
  if (delta === null) return "text-taupe-dark";
  if (delta > 0) return "text-green-700";
  if (delta < 0) return "text-red-700";
  return "text-taupe-dark";
}

function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  return `${format(s, "MMM d")} \u2013 ${format(e, "MMM d, yyyy")}`;
}

// ── Waterfall SVG ─────────────────────────────

function WaterfallChart({
  revenueA,
  revenueB,
  campaignCountEffect,
  audienceSizeEffect,
  rprEffect,
  interactionResidual,
}: {
  revenueA: number;
  revenueB: number;
  campaignCountEffect: number;
  audienceSizeEffect: number;
  rprEffect: number;
  interactionResidual: number;
}) {
  // Running totals for bar positioning
  const r0 = revenueA;
  const r1 = r0 + campaignCountEffect;
  const r2 = r1 + audienceSizeEffect;
  const r3 = r2 + rprEffect;
  const r4 = r3 + interactionResidual; // should equal revenueB

  const rows = [
    { label: "Period A", start: 0, end: r0, isTotal: true },
    { label: "Campaign count", start: r0, end: r1, isTotal: false },
    { label: "Audience size", start: r1, end: r2, isTotal: false },
    { label: "Rev / recipient", start: r2, end: r3, isTotal: false },
    { label: "Interaction", start: r3, end: r4, isTotal: false },
    { label: "Period B", start: 0, end: revenueB, isTotal: true },
  ];

  // Scale bounds
  const allEdges = rows.flatMap((r) => [r.start, r.end]);
  const minVal = Math.min(0, ...allEdges);
  const maxVal = Math.max(1, ...allEdges);

  const leftMargin = 140;
  const rightPadding = 80;
  const chartWidth = 600 - leftMargin - rightPadding;
  const rowHeight = 30;
  const barHeight = 18;
  const topPad = 4;
  const svgWidth = 600;
  const svgHeight = rows.length * rowHeight + topPad * 2;

  const scale = (v: number) =>
    leftMargin + ((v - minVal) / (maxVal - minVal)) * chartWidth;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full max-w-[600px]"
      role="img"
      aria-label="Revenue gap attribution waterfall chart"
    >
      {rows.map((row, i) => {
        const y = topPad + i * rowHeight;
        const barY = y + (rowHeight - barHeight) / 2;
        const x1 = scale(Math.min(row.start, row.end));
        const x2 = scale(Math.max(row.start, row.end));
        const barW = Math.max(x2 - x1, 1);
        const value = row.end - row.start;

        let fillColor: string;
        if (row.isTotal) {
          fillColor = "#8b8078"; // taupe
        } else if (row.label === "Interaction") {
          fillColor = "#9ca3af"; // gray
        } else {
          fillColor = value >= 0 ? "#22c55e" : "#ef4444"; // green / red
        }

        // Connector line from previous bar's end to this bar's start
        const showConnector = !row.isTotal && i > 0;
        const connectorX = scale(row.start);

        return (
          <g key={i}>
            {/* Label */}
            <text
              x={leftMargin - 8}
              y={y + rowHeight / 2 + 4}
              textAnchor="end"
              fontSize={11}
              className="fill-taupe-dark"
            >
              {row.label}
            </text>

            {/* Connector line */}
            {showConnector && (
              <line
                x1={connectorX}
                y1={barY - (rowHeight - barHeight) / 2}
                x2={connectorX}
                y2={barY}
                stroke="#d1ccc7"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )}

            {/* Bar */}
            <rect
              x={x1}
              y={barY}
              width={barW}
              height={barHeight}
              fill={fillColor}
              rx={2}
            />

            {/* Value label */}
            <text
              x={x2 + 4}
              y={y + rowHeight / 2 + 4}
              fontSize={10}
              className="fill-charcoal"
            >
              {row.isTotal
                ? currencyFmtWhole.format(row.end)
                : deltaCurrencyFmt.format(value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Campaign list column ──────────────────────

function CampaignColumn({
  label,
  total,
  campaigns,
  clientId,
}: {
  label: string;
  total: number;
  campaigns: PeriodCampaign[];
  clientId: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
          {label}
        </p>
        <p className="text-sm font-medium text-charcoal">
          {currencyFmt.format(total)} across {campaigns.length} campaigns
        </p>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-taupe-dark">No campaigns in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-taupe-light/60 bg-white/40">
          <table className="w-full text-sm">
            <thead className="border-b border-taupe-light/60 bg-white/60">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-taupe-dark">
                  Date
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-taupe-dark">
                  Name
                </th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-taupe-dark">
                  Recip.
                </th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-taupe-dark">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe-light/40">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-taupe-light/20">
                  <td className="whitespace-nowrap px-2 py-1.5 text-[12px] tabular-nums text-taupe-dark">
                    {c.sendDate}
                  </td>
                  <td className="max-w-[180px] truncate px-2 py-1.5 text-[12px] text-charcoal">
                    <Link
                      href={`/clients/${clientId}/campaigns/${c.id}`}
                      className="hover:underline"
                      title={c.campaignName}
                    >
                      {c.campaignName.length > 35
                        ? c.campaignName.slice(0, 35) + "\u2026"
                        : c.campaignName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-[12px] tabular-nums text-charcoal">
                    {numberFmt.format(c.recipientCount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-[12px] tabular-nums text-charcoal">
                    {currencyFmt.format(c.conversionValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    a_start?: string;
    a_end?: string;
    b_start?: string;
    b_end?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  // Verify client exists
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // ── Compute default periods ──

  const now = new Date();
  const nowEastern = toZonedTime(now, TIMEZONE);

  const twoMonthsAgo = subMonths(nowEastern, 2);
  const lastMonth = subMonths(nowEastern, 1);

  const defaultAStart = format(startOfMonth(twoMonthsAgo), "yyyy-MM-dd");
  const defaultAEnd = format(endOfMonth(twoMonthsAgo), "yyyy-MM-dd");
  const defaultBStart = format(startOfMonth(lastMonth), "yyyy-MM-dd");
  const defaultBEnd = format(nowEastern, "yyyy-MM-dd");

  const aStart = sp.a_start || defaultAStart;
  const aEnd = sp.a_end || defaultAEnd;
  const bStart = sp.b_start || defaultBStart;
  const bEnd = sp.b_end || defaultBEnd;

  const labelA = formatDateRange(aStart, aEnd);
  const labelB = formatDateRange(bStart, bEnd);

  // ── Fetch data ──

  const [summaryA, summaryB, campaignsA, campaignsB] = await Promise.all([
    queryPeriodSummary(supabase, id, aStart, aEnd),
    queryPeriodSummary(supabase, id, bStart, bEnd),
    queryPeriodCampaigns(supabase, id, aStart, aEnd),
    queryPeriodCampaigns(supabase, id, bStart, bEnd),
  ]);

  // ── Section 1: Headline comparison ──

  const totalDelta = summaryB.totalRevenue - summaryA.totalRevenue;
  const totalDeltaPct = pctChange(summaryA.totalRevenue, summaryB.totalRevenue);

  // ── Section 3: Waterfall attribution ──

  const n_a = summaryA.campaignCount;
  const n_b = summaryB.campaignCount;
  const r_a = summaryA.avgRecipientsPerSend;
  const r_b = summaryB.avgRecipientsPerSend;
  const rpr_a =
    summaryA.totalRecipients > 0
      ? summaryA.totalRevenue / summaryA.totalRecipients
      : 0;
  const rpr_b =
    summaryB.totalRecipients > 0
      ? summaryB.totalRevenue / summaryB.totalRecipients
      : 0;

  const campaignCountEffect = (n_b - n_a) * r_a * rpr_a;
  const audienceSizeEffect = n_b * (r_b - r_a) * rpr_a;
  const rprEffect = n_b * r_b * (rpr_b - rpr_a);
  const interactionResidual =
    totalDelta - campaignCountEffect - audienceSizeEffect - rprEffect;

  const canShowWaterfall = n_a > 0 && n_b > 0;

  // ── Section 2: Funnel rows ──

  const funnelRows = [
    {
      label: "Avg recipients / send",
      a: numberFmt.format(Math.round(summaryA.avgRecipientsPerSend)),
      b: numberFmt.format(Math.round(summaryB.avgRecipientsPerSend)),
      delta: pctChange(
        summaryA.avgRecipientsPerSend,
        summaryB.avgRecipientsPerSend
      ),
    },
    {
      label: "Avg open rate",
      a: fmtPct(summaryA.avgOpenRate),
      b: fmtPct(summaryB.avgOpenRate),
      delta: pctChange(summaryA.avgOpenRate, summaryB.avgOpenRate),
    },
    {
      label: "Avg click rate",
      a: fmtPct(summaryA.avgClickRate),
      b: fmtPct(summaryB.avgClickRate),
      delta: pctChange(summaryA.avgClickRate, summaryB.avgClickRate),
    },
    {
      label: "Avg conversion rate",
      a: fmtPct(summaryA.avgConversionRate),
      b: fmtPct(summaryB.avgConversionRate),
      delta: pctChange(summaryA.avgConversionRate, summaryB.avgConversionRate),
    },
    {
      label: "Revenue / recipient",
      a: fmtRpr(rpr_a),
      b: fmtRpr(rpr_b),
      delta: pctChange(rpr_a, rpr_b),
    },
  ];

  return (
    <>
      <PageHeader title="Analysis" description={client.name} />

      {/* ── Period pickers ── */}
      <form method="get" className="mb-8">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
              Period A
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                name="a_start"
                defaultValue={aStart}
                className="rounded border border-taupe-light bg-white/80 px-2 py-1.5 text-[13px] text-charcoal"
              />
              <span className="text-taupe-dark">&ndash;</span>
              <input
                type="date"
                name="a_end"
                defaultValue={aEnd}
                className="rounded border border-taupe-light bg-white/80 px-2 py-1.5 text-[13px] text-charcoal"
              />
            </div>
            <p className="mt-1 text-[11px] text-taupe">{labelA}</p>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
              Period B
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                name="b_start"
                defaultValue={bStart}
                className="rounded border border-taupe-light bg-white/80 px-2 py-1.5 text-[13px] text-charcoal"
              />
              <span className="text-taupe-dark">&ndash;</span>
              <input
                type="date"
                name="b_end"
                defaultValue={bEnd}
                className="rounded border border-taupe-light bg-white/80 px-2 py-1.5 text-[13px] text-charcoal"
              />
            </div>
            <p className="mt-1 text-[11px] text-taupe">{labelB}</p>
          </div>

          <button
            type="submit"
            className="rounded-md bg-charcoal px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-charcoal/90"
          >
            Update
          </button>
        </div>
      </form>

      <div className="space-y-8">
        {/* ── Section 1: Headline comparison ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
            Revenue comparison
          </h2>

          <div className="flex items-start justify-between gap-4">
            {/* Period A */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
                Period A &middot; {labelA}
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-charcoal">
                {currencyFmt.format(summaryA.totalRevenue)}
              </p>
              <p className="mt-1 text-sm text-taupe-dark">
                {summaryA.campaignCount} campaigns &middot;{" "}
                {numberFmt.format(summaryA.totalRecipients)} recipients
              </p>
            </div>

            {/* Delta badge */}
            <div className="flex flex-col items-center pt-6">
              <span
                className={`inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${
                  totalDelta >= 0
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {deltaCurrencyFmt.format(totalDelta)}
                {totalDeltaPct !== null && (
                  <>
                    {" "}
                    ({totalDeltaPct >= 0 ? "+" : ""}
                    {totalDeltaPct.toFixed(1)}%)
                  </>
                )}
              </span>
            </div>

            {/* Period B */}
            <div className="flex-1 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
                Period B &middot; {labelB}
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-charcoal">
                {currencyFmt.format(summaryB.totalRevenue)}
              </p>
              <p className="mt-1 text-sm text-taupe-dark">
                {summaryB.campaignCount} campaigns &middot;{" "}
                {numberFmt.format(summaryB.totalRecipients)} recipients
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Funnel decomposition ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
            Funnel decomposition
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-taupe-light">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">
                    Metric
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">
                    Period A
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">
                    Period B
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-taupe-light/60">
                {funnelRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-charcoal">
                      {row.label}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-charcoal">
                      {row.a}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-charcoal">
                      {row.b}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right text-[13px] tabular-nums font-medium ${deltaColor(row.delta)}`}
                    >
                      {row.delta !== null
                        ? `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)}%`
                        : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 3: Revenue gap attribution waterfall ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
            Revenue gap attribution
          </h2>

          {canShowWaterfall ? (
            <>
              <WaterfallChart
                revenueA={summaryA.totalRevenue}
                revenueB={summaryB.totalRevenue}
                campaignCountEffect={campaignCountEffect}
                audienceSizeEffect={audienceSizeEffect}
                rprEffect={rprEffect}
                interactionResidual={interactionResidual}
              />

              <div className="mt-6 space-y-1.5 text-sm text-taupe-dark">
                <p>
                  Campaign count: {n_a} &rarr; {n_b} sends contributed{" "}
                  <span className="font-medium text-charcoal">
                    {deltaCurrencyFmt.format(Math.round(campaignCountEffect))}
                  </span>
                </p>
                <p>
                  Audience size:{" "}
                  {numberFmt.format(Math.round(r_a))} &rarr;{" "}
                  {numberFmt.format(Math.round(r_b))} avg per send contributed{" "}
                  <span className="font-medium text-charcoal">
                    {deltaCurrencyFmt.format(Math.round(audienceSizeEffect))}
                  </span>
                </p>
                <p>
                  Revenue per recipient: {fmtRpr(rpr_a)} &rarr; {fmtRpr(rpr_b)}{" "}
                  contributed{" "}
                  <span className="font-medium text-charcoal">
                    {deltaCurrencyFmt.format(Math.round(rprEffect))}
                  </span>
                </p>
                <p>
                  Interaction effects:{" "}
                  <span className="font-medium text-charcoal">
                    {deltaCurrencyFmt.format(Math.round(interactionResidual))}
                  </span>
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-taupe-dark">
              Both periods must have at least one campaign to compute
              attribution.
            </p>
          )}
        </div>

        {/* ── Section 4: Side-by-side campaign lists ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
            Campaign details
          </h2>

          <div className="flex gap-6">
            <CampaignColumn
              label={`Period A \u00b7 ${labelA}`}
              total={summaryA.totalRevenue}
              campaigns={campaignsA}
              clientId={id}
            />
            <CampaignColumn
              label={`Period B \u00b7 ${labelB}`}
              total={summaryB.totalRevenue}
              campaigns={campaignsB}
              clientId={id}
            />
          </div>
        </div>
      </div>
    </>
  );
}
