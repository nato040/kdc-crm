import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FinanceCharts } from "@/components/finance/finance-charts";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function FinancePage() {
  const supabase = await createClient();

  const [txRes, accountsRes, uploadsRes, receiptsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, account_id, tx_date, description, amount, category")
      .order("tx_date", { ascending: false }),
    supabase
      .from("finance_accounts")
      .select("id, name, account_type")
      .order("name"),
    supabase
      .from("statement_uploads")
      .select("id, file_name, row_count, created_at, account_id")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("receipts")
      .select("id")
      .limit(1),
  ]);

  const transactions = txRes.data ?? [];
  const accounts = accountsRes.data ?? [];
  const recentUploads = uploadsRes.data ?? [];

  const totalRevenue = transactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalCosts = transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const netIncome = totalRevenue - totalCosts;

  // Monthly breakdown for charts
  const monthMap = new Map<string, { revenue: number; costs: number }>();
  for (const tx of transactions) {
    const m = tx.tx_date.slice(0, 7);
    const entry = monthMap.get(m) ?? { revenue: 0, costs: 0 };
    if (tx.amount > 0) {
      entry.revenue += tx.amount;
    } else {
      entry.costs += Math.abs(tx.amount);
    }
    monthMap.set(m, entry);
  }
  const monthlyData = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      const [y, m] = month.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      return { month, label, ...data, net: data.revenue - data.costs };
    });

  // Category breakdown for costs
  const catMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const cat = tx.category || "Uncategorized";
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(tx.amount));
  }
  const categoryData = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const recentTx = transactions.slice(0, 10);
  const hasData = transactions.length > 0;

  return (
    <>
      <PageHeader title="Finance" description="Business revenue & cost overview">
        <Link
          href="/finance/upload"
          className="inline-flex items-center gap-1.5 rounded-md bg-charcoal px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-charcoal-light"
        >
          Upload
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </PageHeader>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total Revenue" value={fmt(totalRevenue)} positive />
        <KPICard label="Total Costs" value={fmt(totalCosts)} />
        <KPICard
          label="Net Income"
          value={fmt(netIncome)}
          positive={netIncome >= 0}
          highlight
        />
        <KPICard label="Transactions" value={transactions.length.toLocaleString()} />
      </div>

      {!hasData ? (
        <Card className="mt-8">
          <CardContent>
            <p className="text-sm text-taupe-dark">
              No transaction data yet.{" "}
              <Link href="/finance/upload" className="font-medium text-charcoal underline hover:text-charcoal-light">
                Upload a statement
              </Link>{" "}
              to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 space-y-6">
          {/* Charts */}
          <FinanceCharts monthlyData={monthlyData} categoryData={categoryData} />

          {/* Recent transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Link
                href="/finance/transactions"
                className="text-xs font-medium text-taupe-dark hover:text-charcoal"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-taupe-light text-xs uppercase tracking-wide text-taupe-dark">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Description</th>
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTx.map((tx) => (
                      <tr key={tx.id} className="border-b border-taupe-light/50">
                        <td className="whitespace-nowrap py-2.5 pr-4 text-charcoal">{tx.tx_date}</td>
                        <td className="max-w-[260px] truncate py-2.5 pr-4 font-medium text-charcoal">
                          {tx.description ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-taupe-dark">{tx.category ?? "—"}</td>
                        <td
                          className={`whitespace-nowrap py-2.5 text-right tabular-nums font-medium ${
                            tx.amount < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {tx.amount < 0 ? "-" : "+"}
                          {fmt(Math.abs(tx.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recent uploads */}
          {recentUploads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentUploads.map((u) => {
                    const acct = accounts.find((a) => a.id === u.account_id);
                    return (
                      <div key={u.id} className="flex items-center justify-between rounded-md border border-taupe-light/50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-charcoal">{u.file_name}</p>
                          <p className="text-xs text-taupe-dark">
                            {acct?.name ?? "Unknown account"} &middot; {u.row_count} rows
                          </p>
                        </div>
                        <p className="text-xs text-taupe-dark">
                          {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function KPICard({
  label,
  value,
  positive,
  highlight,
}: {
  label: string;
  value: string;
  positive?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "ring-1 ring-taupe" : undefined}>
      <CardContent>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-taupe-dark">{label}</p>
        <p
          className={`text-2xl font-semibold tracking-tight ${
            positive === true
              ? "text-emerald-700"
              : positive === false
                ? "text-red-600"
                : "text-charcoal"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
