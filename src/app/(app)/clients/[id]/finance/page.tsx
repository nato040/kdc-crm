import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import { computeCommission } from "@/lib/commission/calculator";
import {
  startOfMonth,
  subYears,
  format,
  getDate,
  formatDistanceToNow,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "America/New_York";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const deltaCurrencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: "always",
});

function getDiagnostic(deltaPct: number): string {
  if (deltaPct > 10) {
    return "You're pacing ahead of the same point last year. On track for a strong month.";
  }
  if (deltaPct > 5) {
    return "You're pacing ahead of the same point last year.";
  }
  if (deltaPct >= -5) {
    return "You're roughly on pace with the same point last year.";
  }
  if (deltaPct >= -10) {
    return "You're slightly behind the same point last year. Within normal variation.";
  }
  return "You're behind the same point last year by more than 10%. Worth investigating.";
}

function getDeltaColor(deltaPct: number): string {
  if (deltaPct > 5) return "bg-green-50 text-green-700";
  if (deltaPct < -5) return "bg-red-50 text-red-700";
  return "bg-taupe-light text-taupe-dark";
}

export default async function ClientFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, last_synced_at")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // ── Determine periods in Eastern time ──

  const now = new Date();
  const nowEastern = toZonedTime(now, TIMEZONE);
  const currentMonthStart = startOfMonth(nowEastern);
  const dayOfMonth = getDate(nowEastern);
  const monthName = format(nowEastern, "MMMM yyyy");
  const todayFormatted = format(nowEastern, "MMMM d, yyyy");

  const currentPeriodStart = format(currentMonthStart, "yyyy-MM-dd");
  const currentPeriodEnd = format(nowEastern, "yyyy-MM-dd");

  // YoY comparison: same month last year, same number of days
  const yoyNow = subYears(nowEastern, 1);
  const yoyMonthStart = startOfMonth(yoyNow);
  const comparisonPeriodStart = format(yoyMonthStart, "yyyy-MM-dd");
  const comparisonPeriodEnd = format(yoyNow, "yyyy-MM-dd");
  const comparisonLabel = "vs. same period last year";
  const comparisonMonthName = format(yoyNow, "MMMM yyyy");

  // ── Compute commission for both periods ──

  let currentCommission = 0;
  let comparisonCommission = 0;
  let computeError: string | null = null;

  try {
    const current = await computeCommission({
      clientId: id,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
    });
    currentCommission = current.statement.commissionAmount;

    const comparison = await computeCommission({
      clientId: id,
      periodStart: comparisonPeriodStart,
      periodEnd: comparisonPeriodEnd,
    });
    comparisonCommission = comparison.statement.commissionAmount;
  } catch (error) {
    computeError =
      error instanceof Error ? error.message : "Failed to compute commission";
  }

  // ── Delta calculation ──

  const deltaDollars = currentCommission - comparisonCommission;
  const deltaPct =
    comparisonCommission > 0
      ? (deltaDollars / comparisonCommission) * 100
      : null;

  // ── Last sync ──

  const lastSynced = client.last_synced_at
    ? formatDistanceToNow(new Date(client.last_synced_at), { addSuffix: true })
    : null;
  const lastSyncedAbsolute = client.last_synced_at
    ? format(new Date(client.last_synced_at), "MMM d, yyyy h:mm a")
    : null;

  // ── Early month empty state ──

  const isEarlyMonth = dayOfMonth <= 2 && currentCommission === 0;

  return (
    <>
      <PageHeader
        title="Finance"
        description={client.name}
      />

      {/* Last sync badge */}
      {lastSynced && (
        <div className="mb-6">
          <span
            className="inline-block rounded-full bg-taupe-light px-3 py-1 text-[11px] font-medium text-taupe-dark"
            title={lastSyncedAbsolute ?? undefined}
          >
            Data last synced {lastSynced}
          </span>
        </div>
      )}

      {computeError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm text-red-700">
            Failed to compute commission: {computeError}
          </p>
        </div>
      ) : isEarlyMonth ? (
        <div className="rounded-lg border border-taupe-light bg-white/60 px-6 py-12 text-center">
          <p className="text-lg font-medium text-charcoal">
            The month just started
          </p>
          <p className="mt-2 text-sm text-taupe-dark">
            Not enough data yet. Check back in a few days.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current month */}
          <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
              This month so far
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-charcoal">
              {currencyFmt.format(currentCommission)}
            </p>
            <p className="mt-2 text-sm text-taupe-dark">
              as of {todayFormatted}, day {dayOfMonth} of {monthName}
            </p>

            {/* Comparison */}
            <div className="mt-6 border-t border-taupe-light/60 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-dark">
                {comparisonLabel} ({comparisonMonthName}, day {dayOfMonth})
              </p>
              <p className="mt-1 text-2xl font-medium text-taupe-dark">
                {currencyFmt.format(comparisonCommission)}
              </p>

              {/* Delta badge */}
              {deltaPct !== null ? (
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${getDeltaColor(deltaPct)}`}
                >
                  {deltaCurrencyFmt.format(deltaDollars)} (
                  {deltaPct >= 0 ? "+" : ""}
                  {deltaPct.toFixed(1)}%)
                </span>
              ) : (
                <span className="mt-2 inline-block rounded-full bg-taupe-light px-3 py-1 text-sm font-semibold text-taupe-dark">
                  {deltaCurrencyFmt.format(deltaDollars)} ({"\u2014"})
                </span>
              )}
            </div>

            {/* Diagnostic */}
            <p className="mt-4 text-sm text-taupe-dark">
              {deltaPct !== null
                ? getDiagnostic(deltaPct)
                : currentCommission > 0
                  ? "No comparison data from last year for this period."
                  : "No campaign revenue recorded this month yet."}
            </p>
          </div>

          {/* Drill-in link */}
          <div>
            <Link
              href={`/clients/${id}/campaigns?sort=send_time&dir=desc`}
              className="text-[13px] font-medium text-taupe-dark underline hover:text-charcoal transition-colors"
            >
              See this month's campaigns
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
