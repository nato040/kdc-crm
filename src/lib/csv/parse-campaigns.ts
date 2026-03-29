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

export interface CampaignRow {
  client_id: string;
  campaign_name: string | null;
  send_date: string | null;
  delivered: number;
  clicks: number;
  orders: number;
  revenue: number;
  ctr: number | null;
  cvr: number | null;
  rpr: number | null;
  aov: number | null;
}

export function parseCampaignCSV(csvText: string, clientId: string): CampaignRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }

  const rows: CampaignRow[] = [];

  for (const raw of result.data) {
    const delivered = num(raw["Successful Deliveries"] ?? raw["Delivered"]);
    const clicks = num(raw["Unique Clicks"] ?? raw["Clicks"]);
    const orders = num(raw["Unique Placed Order"] ?? raw["Unique Placed Orders"] ?? raw["Orders"]);
    const revenue = num(raw["Revenue"]);

    if (delivered === 0 && clicks === 0 && revenue === 0) continue;

    rows.push({
      client_id: clientId,
      campaign_name: raw["Campaign Name"]?.trim() || null,
      send_date: parseDate(raw["Send Time"] ?? raw["Send Date"]),
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
