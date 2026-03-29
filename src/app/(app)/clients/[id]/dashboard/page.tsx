import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { notFound } from "next/navigation";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + n.toFixed(4);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1) + "%";
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [campaignRes, flowRes, shopifyRes] = await Promise.all([
    supabase
      .from("campaign_performance")
      .select("campaign_name, send_date, delivered, clicks, orders, revenue")
      .eq("client_id", id),
    supabase
      .from("flow_performance_daily")
      .select("flow_name, day, delivered, clicks, orders, revenue")
      .eq("client_id", id),
    supabase
      .from("monthly_shopify_summary")
      .select("month_start, total_revenue")
      .eq("client_id", id),
  ]);

  const campaigns = campaignRes.data ?? [];
  const flows = flowRes.data ?? [];
  const shopifyMonths = shopifyRes.data ?? [];

  // --- KPI aggregates ---
  const totalCampaignRevenue = campaigns.reduce((s, c) => s + (c.revenue ?? 0), 0);
  const totalFlowRevenue = flows.reduce((s, f) => s + (f.revenue ?? 0), 0);
  const totalCrmRevenue = totalCampaignRevenue + totalFlowRevenue;
  const totalDelivered =
    campaigns.reduce((s, c) => s + (c.delivered ?? 0), 0) +
    flows.reduce((s, f) => s + (f.delivered ?? 0), 0);
  const crmRpr = totalDelivered > 0 ? totalCrmRevenue / totalDelivered : null;
  const totalShopifyRevenue = shopifyMonths.reduce((s, sh) => s + (sh.total_revenue ?? 0), 0);
  const crmPct = totalShopifyRevenue > 0 ? (totalCrmRevenue / totalShopifyRevenue) * 100 : null;

  // --- Revenue by month ---
  const monthMap = new Map<string, { campaign: number; flow: number; shopify: number }>();
  for (const c of campaigns) {
    if (!c.send_date) continue;
    const m = c.send_date.slice(0, 7);
    const e = monthMap.get(m) ?? { campaign: 0, flow: 0, shopify: 0 };
    e.campaign += c.revenue ?? 0;
    monthMap.set(m, e);
  }
  for (const f of flows) {
    if (!f.day) continue;
    const m = typeof f.day === "string" ? f.day.slice(0, 7) : "";
    if (!m) continue;
    const e = monthMap.get(m) ?? { campaign: 0, flow: 0, shopify: 0 };
    e.flow += f.revenue ?? 0;
    monthMap.set(m, e);
  }
  for (const sh of shopifyMonths) {
    const m = sh.month_start?.slice(0, 7);
    if (!m) continue;
    const e = monthMap.get(m) ?? { campaign: 0, flow: 0, shopify: 0 };
    e.shopify = sh.total_revenue ?? 0;
    monthMap.set(m, e);
  }
  const revenueByMonth = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, r]) => ({ month, ...r, total: r.campaign + r.flow }));

  // --- Top 5 campaigns by revenue ---
  const top5Campaigns = [...campaigns]
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 5);

  // --- Top 5 flows by revenue (aggregate by flow_name) ---
  const flowAgg = new Map<string, { revenue: number; delivered: number; orders: number }>();
  for (const f of flows) {
    const name = f.flow_name ?? "Unknown";
    const e = flowAgg.get(name) ?? { revenue: 0, delivered: 0, orders: 0 };
    e.revenue += f.revenue ?? 0;
    e.delivered += f.delivered ?? 0;
    e.orders += f.orders ?? 0;
    flowAgg.set(name, e);
  }
  const top5Flows = Array.from(flowAgg.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  const hasData = campaigns.length > 0 || flows.length > 0;

  return (
    <>
      <PageHeader title={client.name} description="CRM performance overview" />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Total CRM Revenue" value={fmt(totalCrmRevenue)} />
        <KPICard label="Campaign Revenue" value={fmt(totalCampaignRevenue)} />
        <KPICard label="Flow Revenue" value={fmt(totalFlowRevenue)} />
        <KPICard label="CRM RPR" value={fmtDec(crmRpr)} />
        <KPICard label="CRM % of Total" value={crmPct !== null ? fmtPct(crmPct) : "—"} subtitle={crmPct === null ? "Add Shopify data" : undefined} />
      </div>

      {!hasData && (
        <Card className="mt-8">
          <CardContent>
            <p className="text-sm text-taupe-dark">
              No performance data yet. Upload Klaviyo CSVs on the Uploads page to see metrics here.
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Revenue by month */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Revenue by Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-taupe-light text-xs uppercase tracking-wide text-taupe-dark">
                      <th className="pb-2 pr-4 font-medium">Month</th>
                      <th className="pb-2 pr-4 text-right font-medium">Campaign</th>
                      <th className="pb-2 pr-4 text-right font-medium">Flow</th>
                      <th className="pb-2 pr-4 text-right font-medium">CRM Total</th>
                      {shopifyMonths.length > 0 && (
                        <>
                          <th className="pb-2 pr-4 text-right font-medium">Shopify</th>
                          <th className="pb-2 text-right font-medium">CRM %</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByMonth.map((r) => (
                      <tr key={r.month} className="border-b border-taupe-light/50">
                        <td className="py-2.5 pr-4 font-medium text-charcoal">{monthLabel(r.month)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.campaign)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.flow)}</td>
                        <td className="py-2.5 pr-4 text-right font-medium tabular-nums">{fmt(r.total)}</td>
                        {shopifyMonths.length > 0 && (
                          <>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{r.shopify ? fmt(r.shopify) : "—"}</td>
                            <td className="py-2.5 text-right tabular-nums">{r.shopify > 0 ? fmtPct((r.total / r.shopify) * 100) : "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top campaigns & flows */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 5 Campaigns by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {top5Campaigns.length === 0 ? (
                  <p className="text-sm text-taupe-dark">No campaign data yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-taupe-light text-xs uppercase tracking-wide text-taupe-dark">
                        <th className="pb-2 pr-4 font-medium">Campaign</th>
                        <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                        <th className="pb-2 pr-4 text-right font-medium">Delivered</th>
                        <th className="pb-2 text-right font-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top5Campaigns.map((c, i) => (
                        <tr key={i} className="border-b border-taupe-light/50">
                          <td className="max-w-[200px] truncate py-2.5 pr-4 font-medium text-charcoal">
                            {c.campaign_name ?? "Untitled"}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(c.revenue)}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{(c.delivered ?? 0).toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums">{(c.orders ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Flows by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {top5Flows.length === 0 ? (
                  <p className="text-sm text-taupe-dark">No flow data yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-taupe-light text-xs uppercase tracking-wide text-taupe-dark">
                        <th className="pb-2 pr-4 font-medium">Flow</th>
                        <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                        <th className="pb-2 pr-4 text-right font-medium">Delivered</th>
                        <th className="pb-2 text-right font-medium">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top5Flows.map(([name, agg], i) => (
                        <tr key={i} className="border-b border-taupe-light/50">
                          <td className="max-w-[200px] truncate py-2.5 pr-4 font-medium text-charcoal">{name}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(agg.revenue)}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{agg.delivered.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums">{agg.orders.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function KPICard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-taupe-dark">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-charcoal">{value}</p>
        {subtitle && <p className="mt-1 text-[11px] text-taupe-dark">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
