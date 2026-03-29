"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface RevenueMonth {
  month: string;
  label: string;
  campaign: number;
  flow: number;
  total: number;
  shopify: number | null;
}

const COLORS = {
  campaign: "#8b7355",
  flow: "#6b8e7b",
  shopify: "#5b7fa5",
};

function fmtCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function tooltipCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function RevenueTrendChart({ data }: { data: RevenueMonth[] }) {
  const hasShopify = data.some((d) => d.shopify !== null && d.shopify > 0);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 12% 88%)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={{ stroke: "hsl(30 12% 88%)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtCurrency}
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value, name) => [
            tooltipCurrency(Number(value)),
            name,
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(30 12% 88%)",
            fontSize: 12,
            backgroundColor: "hsl(40 33% 96%)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="square"
          iconSize={10}
        />
        <Bar
          dataKey="campaign"
          name="Campaign"
          stackId="crm"
          fill={COLORS.campaign}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="flow"
          name="Flow"
          stackId="crm"
          fill={COLORS.flow}
          radius={[3, 3, 0, 0]}
        />
        {hasShopify && (
          <Line
            dataKey="shopify"
            name="Shopify Total"
            stroke={COLORS.shopify}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.shopify }}
            activeDot={{ r: 5 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
