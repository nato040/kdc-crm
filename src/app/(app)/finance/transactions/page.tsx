import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [txRes, accountsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, account_id, tx_date, description, amount, category, reference, notes")
      .order("tx_date", { ascending: false })
      .limit(500),
    supabase.from("finance_accounts").select("id, name").order("name"),
  ]);

  const transactions = txRes.data ?? [];
  const accounts = accountsRes.data ?? [];
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader title="Transactions" description="All imported transactions">
        <Link
          href="/finance/upload"
          className="inline-flex items-center gap-1.5 rounded-md bg-charcoal px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-charcoal-light"
        >
          Upload
        </Link>
      </PageHeader>

      {transactions.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-taupe-dark">
              No transactions yet.{" "}
              <Link href="/finance/upload" className="font-medium text-charcoal underline">
                Upload a statement
              </Link>{" "}
              to import transactions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-taupe-light text-xs uppercase tracking-wide text-taupe-dark">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-taupe-light/50 hover:bg-taupe-light/20">
                      <td className="whitespace-nowrap px-4 py-2.5 text-charcoal">{tx.tx_date}</td>
                      <td className="max-w-[300px] truncate px-4 py-2.5 font-medium text-charcoal">
                        {tx.description ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-taupe-dark">
                        {accountMap.get(tx.account_id) ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-taupe-dark">{tx.category ?? "—"}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium ${
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
            {transactions.length >= 500 && (
              <p className="border-t border-taupe-light px-4 py-3 text-center text-xs text-taupe-dark">
                Showing first 500 transactions
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
