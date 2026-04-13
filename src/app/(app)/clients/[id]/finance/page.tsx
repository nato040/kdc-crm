import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  getDate,
  getDaysInMonth,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { computeCommission } from "@/lib/commission/calculator";
import { queryRevenueByMonth } from "@/lib/finance/revenue";

const TIMEZONE = "America/New_York";

// Consultancy started Jan 1, 2026. Used to determine which
// complete months exist for trailing comparison and cumulative totals.
const CONSULTANCY_START_YEAR = 2026;
const CONSULTANCY_START_MONTH = 0; // 0-indexed: January

// ── Formatters ────────────────────────────────

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

// ── Diagnostic helpers ────────────────────────

function getDiagnostic(deltaPct: number | null): string {
  if (deltaPct === null) {
    return "Not enough consultancy history yet for a comparison.";
  }
  if (deltaPct > 10) {
    return "You\u2019re pacing ahead of your recent months.";
  }
  if (deltaPct > 0) {
    return "You\u2019re slightly ahead of your recent average.";
  }
  if (deltaPct > -10) {
    return "You\u2019re slightly behind your recent average.";
  }
  return "You\u2019re behind your recent average by more than 10%.";
}

function getDeltaColor(deltaPct: number): string {
  if (deltaPct > 5) return "bg-green-50 text-green-700";
  if (deltaPct < -5) return "bg-red-50 text-red-700";
  return "bg-taupe-light text-taupe-dark";
}

function getTrajectory(deltaPct: number): string {
  if (deltaPct > 15) return "Strong growth trajectory over the past 24 months.";
  if (deltaPct > 5) return "Moderate growth trajectory over the past 24 months.";
  if (deltaPct >= -5) return "Roughly flat performance over the past 24 months.";
  if (deltaPct >= -15)
    return "Moderate decline over the past 24 months.";
  return "Significant decline over the past 24 months.";
}

// ── Sparkline SVG ─────────────────────────────

function Sparkline({
  values,
  width,
  height,
  dividerFraction,
}: {
  values: number[];
  width: number;
  height: number;
  /** Fraction (0–1) of chart width where vertical divider is drawn */
  dividerFraction?: number;
}) {
  if (values.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-taupe"
      >
        No data
      </div>
    );
  }

  const pad = 6;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const points = values.map((v, i) => {
    const x =
      pad +
      (values.length > 1 ? (i / (values.length - 1)) * chartW : chartW / 2);
    const y = pad + chartH - ((v - minVal) / range) * chartH;
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="inline-block"
      role="img"
      aria-label="Revenue sparkline"
    >
      {dividerFraction !== undefined && (
        <line
          x1={pad + dividerFraction * chartW}
          y1={0}
          x2={pad + dividerFraction * chartW}
          y2={height}
          stroke="#d1ccc7"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke="#8b8078"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill="#8b8078" />
      ))}
    </svg>
  );
}

// ── Main page ─────────────────────────────────

export default async function ClientFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // ── Time boundaries in Eastern time ──

  const now = new Date();
  const nowEastern = toZonedTime(now, TIMEZONE);
  const currentMonthStart = startOfMonth(nowEastern);
  const dayOfMonth = getDate(nowEastern);
  const daysInCurrentMonth = getDaysInMonth(nowEastern);
  const monthName = format(nowEastern, "MMMM yyyy");
  const todayFormatted = format(nowEastern, "MMMM d, yyyy");

  const currentPeriodStart = format(currentMonthStart, "yyyy-MM-dd");
  const currentPeriodEnd = format(nowEastern, "yyyy-MM-dd");

  // ── Build list of complete consultancy months ──

  const consultancyStart = new Date(
    CONSULTANCY_START_YEAR,
    CONSULTANCY_START_MONTH,
    1
  );
  const completeMonths: Array<{
    start: string;
    end: string;
    label: string;
    key: string;
  }> = [];

  let cursor = startOfMonth(consultancyStart);
  while (cursor < currentMonthStart) {
    completeMonths.push({
      start: format(cursor, "yyyy-MM-dd"),
      end: format(endOfMonth(cursor), "yyyy-MM-dd"),
      label: format(cursor, "MMMM yyyy"),
      key: format(cursor, "yyyy-MM"),
    });
    cursor = addMonths(cursor, 1);
  }

  const trailingMonths = completeMonths.slice(-3);

  // ── Fetch all commission data in parallel ──

  let currentCommission = 0;
  const monthlyCommissions: Array<{ key: string; label: string; amount: number }> = [];
  let computeError: string | null = null;

  try {
    // Current month + all complete months
    const commissionPromises = [
      computeCommission({
        clientId: id,
        periodStart: currentPeriodStart,
        periodEnd: currentPeriodEnd,
      }),
      ...completeMonths.map((m) =>
        computeCommission({
          clientId: id,
          periodStart: m.start,
          periodEnd: m.end,
        })
      ),
    ];

    const results = await Promise.all(commissionPromises);
    currentCommission = results[0].statement.commissionAmount;

    for (let i = 0; i < completeMonths.length; i++) {
      monthlyCommissions.push({
        key: completeMonths[i].key,
        label: completeMonths[i].label,
        amount: results[i + 1].statement.commissionAmount,
      });
    }
  } catch (error) {
    computeError =
      error instanceof Error ? error.message : "Failed to compute commission";
  }

  // ── Panel 1: Trailing comparison ──

  const trailingCommissionValues = monthlyCommissions
    .slice(-3)
    .map((m) => m.amount);

  const trailingCount = trailingCommissionValues.length;
  const trailingAvg =
    trailingCount > 0
      ? trailingCommissionValues.reduce((s, v) => s + v, 0) / trailingCount
      : null;

  // Pace-adjusted: if we're N days into a D-day month,
  // the fair comparison is average × (N / D)
  const paceFraction =
    daysInCurrentMonth > 0 ? dayOfMonth / daysInCurrentMonth : 0;
  const paceAdjustedComparison =
    trailingAvg !== null ? trailingAvg * paceFraction : null;

  const paceDelta =
    paceAdjustedComparison !== null && paceAdjustedComparison > 0
      ? currentCommission - paceAdjustedComparison
      : null;
  const paceDeltaPct =
    paceAdjustedComparison !== null && paceAdjustedComparison > 0
      ? (paceDelta! / paceAdjustedComparison) * 100
      : null;

  // ── Panel 1: Seasonality context ──

  // Query all historical monthly revenue (pre-consultancy included)
  // for seasonality ratio computation
  let seasonalityNote: string | null = null;

  try {
    const allRevenue = await queryRevenueByMonth(
      supabase,
      id,
      "2024-01-01",
      currentPeriodEnd
    );

    const revenueMap = new Map<string, number>();
    for (const entry of allRevenue) {
      revenueMap.set(entry.month, entry.revenue);
    }

    // Current month number (0-indexed)
    const currentMonthIdx = nowEastern.getMonth();
    const currentMonthNameShort = format(nowEastern, "MMMM");
    const currentYear = nowEastern.getFullYear();

    // Find all prior same-month observations (exclude current year)
    const ratios: number[] = [];

    for (let year = 2024; year < currentYear; year++) {
      const targetKey = `${year}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
      const targetRevenue = revenueMap.get(targetKey);
      if (targetRevenue === undefined || targetRevenue === 0) continue;

      // Get trailing 3 months for that observation
      const trailingRevs: number[] = [];
      for (let offset = 1; offset <= 3; offset++) {
        const trailDate = subMonths(
          new Date(year, currentMonthIdx, 1),
          offset
        );
        const trailKey = format(trailDate, "yyyy-MM");
        const trailRev = revenueMap.get(trailKey);
        if (trailRev !== undefined) trailingRevs.push(trailRev);
      }

      if (trailingRevs.length === 0) continue;

      const trailAvg =
        trailingRevs.reduce((s, v) => s + v, 0) / trailingRevs.length;
      if (trailAvg === 0) continue;

      ratios.push(targetRevenue / trailAvg);
    }

    if (ratios.length > 0) {
      const avgRatio =
        ratios.reduce((s, v) => s + v, 0) / ratios.length;
      const pctDiff = Math.round(Math.abs(avgRatio - 1) * 100);
      const direction = avgRatio >= 1 ? "above" : "below";
      seasonalityNote = `Historically, ${currentMonthNameShort} runs about ${pctDiff}% ${direction} the trailing-3 average for this account, based on ${ratios.length} prior observation${ratios.length > 1 ? "s" : ""}.`;
    }
  } catch {
    // Seasonality is best-effort — skip if query fails
  }

  // ── Panel 2: Consultancy cumulative ──

  const cumulativeCommission = monthlyCommissions.reduce(
    (s, m) => s + m.amount,
    0
  );
  const completeMonthCount = monthlyCommissions.length;
  const monthlyAvg =
    completeMonthCount > 0 ? cumulativeCommission / completeMonthCount : 0;
  const sparklineCommissionValues = monthlyCommissions.map((m) => m.amount);

  // ── Panel 3: Account performance (24 months) ──

  let last12Revenue = 0;
  let prev12Revenue = 0;
  let sparkline24Values: number[] = [];
  let panel3Error: string | null = null;

  try {
    // 24 complete months before current month
    const month24Start = subMonths(currentMonthStart, 24);
    const month12Start = subMonths(currentMonthStart, 12);
    const lastCompleteMonth = subMonths(currentMonthStart, 1);

    const allRevenue = await queryRevenueByMonth(
      supabase,
      id,
      format(month24Start, "yyyy-MM-dd"),
      format(endOfMonth(lastCompleteMonth), "yyyy-MM-dd")
    );

    const revenueMap = new Map<string, number>();
    for (const entry of allRevenue) {
      revenueMap.set(entry.month, entry.revenue);
    }

    // Build 24-month array and compute totals
    const months24: string[] = [];
    for (let i = 23; i >= 0; i--) {
      const m = subMonths(currentMonthStart, i + 1); // +1 because current month is incomplete
      months24.push(format(m, "yyyy-MM"));
    }

    sparkline24Values = months24.map((k) => revenueMap.get(k) ?? 0);

    // First 12 = previous 12 months, last 12 = most recent 12 months
    prev12Revenue = sparkline24Values
      .slice(0, 12)
      .reduce((s, v) => s + v, 0);
    last12Revenue = sparkline24Values
      .slice(12)
      .reduce((s, v) => s + v, 0);
  } catch (error) {
    panel3Error =
      error instanceof Error ? error.message : "Failed to load account data";
  }

  const accountDelta = last12Revenue - prev12Revenue;
  const accountDeltaPct =
    prev12Revenue > 0 ? (accountDelta / prev12Revenue) * 100 : null;

  // ── Early month empty state ──

  const isEarlyMonth = dayOfMonth <= 2 && currentCommission === 0;

  return (
    <>
      <PageHeader title="Finance" description={client.name} />

      {computeError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm text-red-700">
            Failed to compute commission: {computeError}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ═══ Panel 1: This month so far ═══ */}
          <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
              This month so far
            </p>

            {isEarlyMonth ? (
              <div className="mt-4">
                <p className="text-lg font-medium text-charcoal">
                  The month just started
                </p>
                <p className="mt-1 text-sm text-taupe-dark">
                  Not enough data yet. Check back in a few days.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-charcoal">
                  {currencyFmt.format(currentCommission)}
                </p>
                <p className="mt-2 text-sm text-taupe-dark">
                  as of {todayFormatted}, day {dayOfMonth} of {monthName}
                </p>

                {/* Trailing comparison */}
                <div className="mt-6 border-t border-taupe-light/60 pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
                    Trailing {trailingCount}-month average (pace-adjusted to
                    day {dayOfMonth})
                  </p>

                  {paceAdjustedComparison !== null ? (
                    <>
                      <p className="mt-1 text-2xl font-medium text-taupe-dark">
                        {currencyFmt.format(paceAdjustedComparison)}
                      </p>

                      {paceDelta !== null && paceDeltaPct !== null ? (
                        <span
                          className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${getDeltaColor(paceDeltaPct)}`}
                        >
                          {deltaCurrencyFmt.format(Math.round(paceDelta))} (
                          {paceDeltaPct >= 0 ? "+" : ""}
                          {paceDeltaPct.toFixed(1)}%)
                        </span>
                      ) : null}

                      <p className="mt-3 text-sm text-taupe-dark">
                        {getDiagnostic(paceDeltaPct)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-taupe-dark">
                      {getDiagnostic(null)}
                    </p>
                  )}

                  {/* Seasonality context */}
                  {seasonalityNote && (
                    <p className="mt-3 text-sm italic text-taupe">
                      {seasonalityNote}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ═══ Panel 2: Consultancy income since January 1 ═══ */}
          <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
              Since January 1
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-charcoal">
              {currencyFmt.format(cumulativeCommission)}
            </p>
            <p className="mt-2 text-sm text-taupe-dark">
              {completeMonthCount > 0
                ? `across ${completeMonthCount} complete month${completeMonthCount > 1 ? "s" : ""}, averaging ${currencyFmt.format(monthlyAvg)}/month`
                : "No complete months yet"}
            </p>

            {sparklineCommissionValues.length > 0 && (
              <div className="mt-4">
                <Sparkline
                  values={sparklineCommissionValues}
                  width={200}
                  height={40}
                />
              </div>
            )}
          </div>

          {/* ═══ Panel 3: Account performance, last 24 months ═══ */}
          <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
              Account performance
            </p>
            <p className="mt-0.5 text-[12px] italic text-taupe">
              (last 24 months &mdash; includes pre-consultancy period)
            </p>

            {panel3Error ? (
              <p className="mt-4 text-sm text-red-700">
                Failed to load account data: {panel3Error}
              </p>
            ) : (
              <>
                {/* Side-by-side totals */}
                <div className="mt-5 flex items-baseline gap-8">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-taupe-dark">
                      Last 12 months
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-charcoal">
                      {currencyFmtWhole.format(last12Revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-taupe-dark">
                      Previous 12 months
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-charcoal">
                      {currencyFmtWhole.format(prev12Revenue)}
                    </p>
                  </div>
                </div>

                {/* Delta badge */}
                <div className="mt-3">
                  {accountDeltaPct !== null ? (
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${getDeltaColor(accountDeltaPct)}`}
                    >
                      {deltaCurrencyFmt.format(Math.round(accountDelta))} (
                      {accountDeltaPct >= 0 ? "+" : ""}
                      {accountDeltaPct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-taupe-light px-3 py-1 text-sm font-semibold text-taupe-dark">
                      {deltaCurrencyFmt.format(Math.round(accountDelta))} (
                      &mdash;)
                    </span>
                  )}
                </div>

                {/* 24-month sparkline */}
                {sparkline24Values.length > 0 && (
                  <div className="mt-4">
                    <Sparkline
                      values={sparkline24Values}
                      width={300}
                      height={50}
                      dividerFraction={0.5}
                    />
                  </div>
                )}

                {/* Trajectory diagnostic */}
                <p className="mt-3 text-sm text-taupe-dark">
                  {accountDeltaPct !== null
                    ? getTrajectory(accountDeltaPct)
                    : "Not enough historical data for trajectory analysis."}
                </p>

                {/* Framing note */}
                <p className="mt-3 text-[12px] italic text-taupe">
                  This reflects the account&apos;s Klaviyo revenue, which
                  predates the consultancy arrangement. Shown for performance
                  context &mdash; not commission earned.
                </p>
              </>
            )}
          </div>

          {/* ═══ Page footer ═══ */}
          <p className="text-[11px] text-taupe">
            Pace comparisons use monthly averages and do not adjust for
            day-of-week effects. Seasonality adjustments are based on this
            account&apos;s historical Klaviyo data where available.
          </p>
        </div>
      )}
    </>
  );
}
