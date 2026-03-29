"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface SplitData {
  name: string;
  value: number;
}

const COLORS = ["#8b7355", "#6b8e7b"];

function tooltipCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function RevenueSplitChart({ data }: { data: SplitData[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-sm text-taupe-dark">
        No revenue data to display.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            dataKey="value"
            stroke="hsl(40 33% 96%)"
            strokeWidth={3}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => tooltipCurrency(Number(value))}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(30 12% 88%)",
              fontSize: 12,
              backgroundColor: "hsl(40 33% 96%)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex shrink-0 flex-col gap-3">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-xs text-taupe-dark">{d.name}</span>
            <span className="ml-1 text-xs font-semibold text-charcoal tabular-nums">
              {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
