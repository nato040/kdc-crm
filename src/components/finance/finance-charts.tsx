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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MonthlyRow {
  label: string;
  revenue: number;
  costs: number;
  net: number;
}

interface CategoryRow {
  name: string;
  value: number;
}

const COLORS = {
  revenue: "#4a7c59",
  costs: "#b85c4a",
  net: "#5b7fa5",
};

const PIE_COLORS = [
  "#8b7355",
  "#6b8e7b",
  "#5b7fa5",
  "#c4956a",
  "#7b6b8e",
  "#5a8e8b",
  "#a38b6b",
  "#8e6b7b",
];

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
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

export function FinanceCharts({
  monthlyData,
  categoryData,
}: {
  monthlyData: MonthlyRow[];
  categoryData: CategoryRow[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Revenue vs Costs trend */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue vs Costs</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <p className="flex h-[300px] items-center justify-center text-sm text-taupe-dark">
              No data to display.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={monthlyData}
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
                  dataKey="revenue"
                  name="Revenue"
                  fill={COLORS.revenue}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="costs"
                  name="Costs"
                  fill={COLORS.costs}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  dataKey="net"
                  name="Net"
                  stroke={COLORS.net}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.net }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cost breakdown by category */}
      <Card>
        <CardHeader>
          <CardTitle>Costs by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="flex h-[300px] items-center justify-center text-sm text-taupe-dark">
              No cost data yet.
            </p>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="hsl(40 33% 96%)"
                    strokeWidth={2}
                  >
                    {categoryData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
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
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {categoryData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                    <span className="truncate text-[11px] text-taupe-dark">
                      {d.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
