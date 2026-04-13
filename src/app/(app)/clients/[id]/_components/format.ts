/**
 * Shared formatting helpers for client data tables.
 * Private to the client route segment — not exported to the rest of the app.
 */

const numberFmt = new Intl.NumberFormat("en-US");
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number with thousands separators: 158221 → "158,221" */
export function fmtCount(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return numberFmt.format(value);
}

/** Format currency: 8024.87 → "$8,024.87" */
export function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return currencyFmt.format(value);
}

/** Format percentage with 1 decimal: 0.359 → "35.9%" */
export function fmtPct(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a date string as "MMM D, YYYY" in Eastern time.
 * Uses Intl.DateTimeFormat to handle timezone correctly.
 */
export function fmtDate(
  value: string | null | undefined,
  opts?: { includeTime?: boolean }
): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "\u2014";

  if (opts?.includeTime) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Display a value or em-dash for null/undefined */
export function fmtText(value: string | null | undefined, maxLen?: number): {
  display: string;
  full: string | null;
} {
  if (!value) return { display: "\u2014", full: null };
  if (maxLen && value.length > maxLen) {
    return { display: value.slice(0, maxLen) + "\u2026", full: value };
  }
  return { display: value, full: null };
}

/** Format boolean: true → "Yes", false → "No", null → "—" */
export function fmtBool(value: boolean | null | undefined): string {
  if (value == null) return "\u2014";
  return value ? "Yes" : "No";
}
