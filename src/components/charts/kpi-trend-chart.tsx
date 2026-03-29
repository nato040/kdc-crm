"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface KpiMonth {
  label: string;
  avgCtr: number | null;
  avgCvr: number | null;
  avgRpr: number | null;
}

const COLORS = {
  ctr: "#6b8e7b",
  cvr: "#c4956a",
  rpr: "#8b7355",
};

export function KpiTrendChart({
  data,
  source,
}: {
  data: KpiMonth[];
  source: "campaign" | "flow";
}) {
  const filtered = data.filter(
    (d) => d.avgCtr !== null || d.avgCvr !== null || d.avgRpr !== null
  );

  if (filtered.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-sm text-taupe-dark">
        No {source} data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={filtered}
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
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          tick={{ fontSize: 11, fill: "hsl(25 8% 42%)" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toFixed(2)}%`,
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
          iconType="line"
          iconSize={14}
        />
        <Line
          type="monotone"
          dataKey="avgCtr"
          name="CTR"
          stroke={COLORS.ctr}
          strokeWidth={2}
          dot={{ r: 3, fill: COLORS.ctr }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="avgCvr"
          name="CVR"
          stroke={COLORS.cvr}
          strokeWidth={2}
          dot={{ r: 3, fill: COLORS.cvr }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="avgRpr"
          name="RPR"
          stroke={COLORS.rpr}
          strokeWidth={2}
          dot={{ r: 3, fill: COLORS.rpr }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
