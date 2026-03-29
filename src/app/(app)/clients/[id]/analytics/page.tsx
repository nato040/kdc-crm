import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { notFound } from "next/navigation";
import { RevenueTrendChart } from "@/components/charts/revenue-trend-chart";
import { AttributionTrendChart } from "@/components/charts/attribution-trend-chart";
import { KpiTrendChart } from "@/components/charts/kpi-trend-chart";
import { RevenueSplitChart } from "@/components/charts/revenue-split-chart";
import { TopPerformersChart } from "@/components/charts/top-performers-chart";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default async function AnalyticsPage({
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
      .select(
        "campaign_name, send_date, delivered, clicks, orders, revenue, ctr, cvr, rpr"
      )
      .eq("client_id", id)
      .order("send_date", { ascending: true }),
    supabase
      .from("flow_performance_daily")
      .select(
        "flow_name, day, delivered, clicks, orders, revenue, ctr, cvr, rpr"
      )
      .eq("client_id", id)
      .order("day", { ascending: true }),
    supabase
      .from("monthly_shopify_summary")
      .select("month_start, total_revenue")
      .eq("client_id", id)
      .order("month_start", { ascending: true }),
  ]);

  const campaigns = campaignRes.data ?? [];
  const flows = flowRes.data ?? [];
  const shopifyMonths = shopifyRes.data ?? [];
  const hasData = campaigns.length > 0 || flows.length > 0;

  // --- Revenue by month (for trend chart) ---
  const monthMap = new Map<
    string,
    { campaign: number; flow: number; shopify: number | null }
  >();

  for (const c of campaigns) {
    if (!c.send_date) continue;
    const m = c.send_date.slice(0, 7);
    const e = monthMap.get(m) ?? { campaign: 0, flow: 0, shopify: null };
    e.campaign += c.revenue ?? 0;
    monthMap.set(m, e);
  }
  for (const f of flows) {
    if (!f.day) continue;
    const m = typeof f.day === "string" ? f.day.slice(0, 7) : "";
    if (!m) continue;
    const e = monthMap.get(m) ?? { campaign: 0, flow: 0, shopify: null };
    e.flow += f.revenue ?? 0;
    monthMap.set(m, e);
  }
  for (const sh of shopifyMonths) {
    const m = sh.month_start?.slice(0, 7);
    if (!m) continue;
    const e = monthMap.get(m) ?? { campaign: 0, flow: 0, shopify: null };
    e.shopify = sh.total_revenue ?? 0;
    monthMap.set(m, e);
  }

  const revenueByMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, r]) => ({
      month,
      label: monthLabel(month),
      campaign: r.campaign,
      flow: r.flow,
      total: r.campaign + r.flow,
      shopify: r.shopify,
    }));

  // --- CRM attribution by month ---
  const attributionByMonth = revenueByMonth.map((r) => ({
    label: r.label,
    crmPercent:
      r.shopify !== null && r.shopify > 0
        ? (r.total / r.shopify) * 100
        : null,
  }));

  // --- Campaign KPI averages by month ---
  const campaignKpiMap = new Map<
    string,
    { ctrSum: number; cvrSum: number; rprSum: number; count: number }
  >();
  for (const c of campaigns) {
    if (!c.send_date) continue;
    const m = c.send_date.slice(0, 7);
    const e = campaignKpiMap.get(m) ?? {
      ctrSum: 0,
      cvrSum: 0,
      rprSum: 0,
      count: 0,
    };
    if (c.ctr !== null) e.ctrSum += c.ctr;
    if (c.cvr !== null) e.cvrSum += c.cvr;
    if (c.rpr !== null) e.rprSum += c.rpr;
    e.count += 1;
    campaignKpiMap.set(m, e);
  }
  const campaignKpiByMonth = Array.from(campaignKpiMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, e]) => ({
      label: monthLabel(month),
      avgCtr: e.count > 0 ? e.ctrSum / e.count : null,
      avgCvr: e.count > 0 ? e.cvrSum / e.count : null,
      avgRpr: e.count > 0 ? e.rprSum / e.count : null,
    }));

  // --- Flow KPI averages by month ---
  const flowKpiMap = new Map<
    string,
    { ctrSum: number; cvrSum: number; rprSum: number; count: number }
  >();
  for (const f of flows) {
    if (!f.day) continue;
    const m = typeof f.day === "string" ? f.day.slice(0, 7) : "";
    if (!m) continue;
    const e = flowKpiMap.get(m) ?? {
      ctrSum: 0,
      cvrSum: 0,
      rprSum: 0,
      count: 0,
    };
    if (f.ctr !== null) e.ctrSum += f.ctr;
    if (f.cvr !== null) e.cvrSum += f.cvr;
    if (f.rpr !== null) e.rprSum += f.rpr;
    e.count += 1;
    flowKpiMap.set(m, e);
  }
  const flowKpiByMonth = Array.from(flowKpiMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, e]) => ({
      label: monthLabel(month),
      avgCtr: e.count > 0 ? e.ctrSum / e.count : null,
      avgCvr: e.count > 0 ? e.cvrSum / e.count : null,
      avgRpr: e.count > 0 ? e.rprSum / e.count : null,
    }));

  // --- Revenue split (Campaign vs Flow) ---
  const totalCampaignRevenue = campaigns.reduce(
    (s, c) => s + (c.revenue ?? 0),
    0
  );
  const totalFlowRevenue = flows.reduce((s, f) => s + (f.revenue ?? 0), 0);
  const revenueSplit = [
    { name: "Campaign", value: totalCampaignRevenue },
    { name: "Flow", value: totalFlowRevenue },
  ];

  // --- Top 10 campaigns by revenue ---
  const top10Campaigns = [...campaigns]
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 10)
    .map((c) => ({
      name: c.campaign_name ?? "Untitled",
      revenue: c.revenue ?? 0,
    }));

  // --- Top 10 flows by revenue (aggregated) ---
  const flowAgg = new Map<string, number>();
  for (const f of flows) {
    const name = f.flow_name ?? "Unknown";
    flowAgg.set(name, (flowAgg.get(name) ?? 0) + (f.revenue ?? 0));
  }
  const top10Flows = Array.from(flowAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, revenue]) => ({ name, revenue }));

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Visual performance breakdown for ${client.name}`}
      />

      {!hasData ? (
        <Card>
          <CardContent>
            <p className="text-sm text-taupe-dark">
              No performance data yet. Upload Klaviyo CSVs on the Uploads page
              to see analytics here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Revenue trend + split */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueTrendChart data={revenueByMonth} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Split</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueSplitChart data={revenueSplit} />
              </CardContent>
            </Card>
          </div>

          {/* Row 2: CRM Attribution trend */}
          <Card>
            <CardHeader>
              <CardTitle>CRM % of Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <AttributionTrendChart data={attributionByMonth} />
            </CardContent>
          </Card>

          {/* Row 3: KPI trends side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign KPI Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <KpiTrendChart data={campaignKpiByMonth} source="campaign" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Flow KPI Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <KpiTrendChart data={flowKpiByMonth} source="flow" />
              </CardContent>
            </Card>
          </div>

          {/* Row 4: Top performers */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Campaigns by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <TopPerformersChart data={top10Campaigns} color="#8b7355" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 10 Flows by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <TopPerformersChart data={top10Flows} color="#6b8e7b" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
