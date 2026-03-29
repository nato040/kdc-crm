"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface AttributionMonth {
  label: string;
  crmPercent: number | null;
}

export function AttributionTrendChart({ data }: { data: AttributionMonth[] }) {
  const filtered = data.filter((d) => d.crmPercent !== null);

  if (filtered.length === 0) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-taupe-dark">
        Add Shopify revenue data to see CRM attribution trend.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={filtered}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="attrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b7fa5" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#5b7fa5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 12% 88%)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={{ stroke: "hsl(30 12% 88%)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, "CRM %"]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(30 12% 88%)",
            fontSize: 12,
            backgroundColor: "hsl(40 33% 96%)",
          }}
        />
        <Area
          type="monotone"
          dataKey="crmPercent"
          stroke="#5b7fa5"
          strokeWidth={2}
          fill="url(#attrGrad)"
          dot={{ r: 3, fill: "#5b7fa5" }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
