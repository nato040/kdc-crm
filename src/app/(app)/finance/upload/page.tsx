"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatementUploader } from "@/components/finance/statement-uploader";
import { ReceiptUploader } from "@/components/finance/receipt-uploader";
import { AccountForm } from "@/components/finance/account-form";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function UploadPage() {
  const [accounts, setAccounts] = useState<
    { id: string; name: string; account_type: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("finance_accounts")
      .select("id, name, account_type")
      .order("name");
    setAccounts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return (
    <>
      <PageHeader
        title="Upload"
        description="Import bank &amp; AMEX statements or upload receipts."
      />

      {/* Accounts list */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Accounts</CardTitle>
          <AccountForm onCreated={loadAccounts} />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-taupe-dark">Loading accounts\u2026</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-taupe-dark">
              No accounts yet. Add a bank account or credit card to start uploading statements.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-taupe-light px-4 py-3"
                >
                  <p className="text-sm font-medium text-charcoal">{a.name}</p>
                  <p className="text-xs text-taupe-dark">
                    {a.account_type.replace("_", " ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatementUploader accounts={accounts} onComplete={loadAccounts} />
        <ReceiptUploader />
      </div>
    </>
  );
}
