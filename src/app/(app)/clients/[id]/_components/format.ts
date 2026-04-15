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

// 4-decimal currency for revenue-per-recipient: $0.0234
const rprFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
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

/** Format RPR (revenue per recipient) with 4 decimal places: 0.0234 → "$0.0234" */
export function fmtRpr(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return rprFmt.format(value);
}

/** Format percentage with 2 decimals: 0.0042 → "0.42%" */
export function fmtPct2(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `${(value * 100).toFixed(2)}%`;
}

/** Format percentage with 4 decimals: 0.000432 → "0.0432%" */
export function fmtPct4(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `${(value * 100).toFixed(4)}%`;
}

/** Abbreviated day of week in Eastern time: "Mon", "Tue", etc. */
export function fmtDayAbbr(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date);
}

/** Full day of week in Eastern time: "Monday", "Tuesday", etc. */
export function fmtDayFull(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  }).format(date);
}

/**
 * Compute orders-per-recipient as a ratio, or null if inputs are
 * missing/zero. Caller formats with fmtPct4.
 */
export function computeOrdersPerRecipient(
  conversionCount: number | null | undefined,
  recipientCount: number | null | undefined
): number | null {
  if (!conversionCount || !recipientCount) return null;
  return conversionCount / recipientCount;
}

/**
 * Compute orders-per-click as a ratio, or null if inputs are
 * missing/zero. Caller formats with fmtPct2.
 */
export function computeOrdersPerClick(
  conversionCount: number | null | undefined,
  clicksUnique: number | null | undefined
): number | null {
  if (!conversionCount || !clicksUnique) return null;
  return conversionCount / clicksUnique;
}
