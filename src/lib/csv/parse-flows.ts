import Papa from "papaparse";

function num(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val).replace(/[$,%]/g, "").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function safeDiv(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

function parseDate(val: unknown): string | null {
  if (!val || String(val).trim() === "") return null;
  const d = new Date(String(val).trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export interface FlowRow {
  client_id: string;
  day: string | null;
  flow_name: string | null;
  flow_message_name: string | null;
  delivered: number;
  clicks: number;
  orders: number;
  revenue: number;
  ctr: number | null;
  cvr: number | null;
  rpr: number | null;
  aov: number | null;
}

/**
 * Klaviyo flow CSVs often have metadata rows before the actual header.
 * We find the header row by looking for a line that starts with "Day,".
 * Everything before that is discarded.
 */
function stripMetadataRows(csvText: string): string {
  const lines = csvText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimStart();
    if (/^Day[,\t]/i.test(line)) {
      return lines.slice(i).join("\n");
    }
  }

  return csvText;
}

export function parseFlowCSV(csvText: string, clientId: string): FlowRow[] {
  const cleaned = stripMetadataRows(csvText);

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }

  const rows: FlowRow[] = [];

  for (const raw of result.data) {
    const delivered = num(raw["Delivered"] ?? raw["Successful Deliveries"]);
    const clicks = num(raw["Unique Clicks"] ?? raw["Clicks"]);
    const orders = num(raw["Placed Order"] ?? raw["Unique Placed Orders"] ?? raw["Orders"]);
    const revenue = num(raw["Revenue"]);

    if (delivered === 0 && clicks === 0 && revenue === 0) continue;

    rows.push({
      client_id: clientId,
      day: parseDate(raw["Day"] ?? raw["Date"]),
      flow_name: raw["Flow Name"]?.trim() || null,
      flow_message_name: (raw["Flow Message Name"] ?? raw["Message Name"])?.trim() || null,
      delivered,
      clicks,
      orders,
      revenue,
      ctr: safeDiv(clicks, delivered),
      cvr: safeDiv(orders, clicks),
      rpr: safeDiv(revenue, delivered),
      aov: safeDiv(revenue, orders),
    });
  }

  return rows;
}
