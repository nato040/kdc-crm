"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Performer {
  name: string;
  revenue: number;
}

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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

export function TopPerformersChart({
  data,
  color = "#8b7355",
}: {
  data: Performer[];
  color?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-sm text-taupe-dark">
        No data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(30 12% 88%)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={fmtCurrency}
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => truncate(v, 22)}
        />
        <Tooltip
          formatter={(value) => [tooltipCurrency(Number(value)), "Revenue"]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(30 12% 88%)",
            fontSize: 12,
            backgroundColor: "hsl(40 33% 96%)",
          }}
        />
        <Bar dataKey="revenue" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
