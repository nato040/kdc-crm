"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseStatement, type ParsedTransaction, type StatementFormat } from "@/lib/excel/parse-statement";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

interface StatementUploaderProps {
  accounts: { id: string; name: string; account_type: string }[];
  onComplete?: () => void;
}

type Status = "idle" | "select-account" | "parsing" | "preview" | "inserting" | "done" | "error";

export function StatementUploader({ accounts, onComplete }: StatementUploaderProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [format, setFormat] = useState<StatementFormat>("auto");
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<StatementFormat>("auto");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setFile(null);
    setAccountId("");
    setPreview([]);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  function handleFileSelect(f: File) {
    setFile(f);
    if (accounts.length === 1) {
      setAccountId(accounts[0].id);
      parseFile(f, accounts[0].id);
    } else if (accounts.length === 0) {
      setStatus("error");
      setMessage("No finance accounts configured. Add an account first.");
    } else {
      setStatus("select-account");
    }
  }

  async function parseFile(f: File, acctId: string) {
    setStatus("parsing");
    try {
      const buffer = await f.arrayBuffer();
      const result = parseStatement(buffer, format);
      if (result.transactions.length === 0) {
        setStatus("error");
        setMessage("No valid transactions found. Check that the file has Date, Description, and Amount columns.");
        return;
      }
      setPreview(result.transactions);
      setDetectedFormat(result.detectedFormat);
      setAccountId(acctId);
      setStatus("preview");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to parse file.");
    }
  }

  async function confirmInsert() {
    if (!file || !accountId || preview.length === 0) return;
    setStatus("inserting");
    setMessage(`Inserting ${preview.length} transactions\u2026`);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: upload, error: uploadErr } = await supabase
        .from("statement_uploads")
        .insert({
          account_id: accountId,
          file_name: file.name,
          upload_month: preview[0].tx_date.slice(0, 7) + "-01",
          row_count: preview.length,
          uploaded_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (uploadErr) throw new Error(uploadErr.message);

      const rows = preview.map((tx) => ({
        account_id: accountId,
        statement_upload_id: upload.id,
        tx_date: tx.tx_date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        reference: tx.reference,
      }));

      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from("transactions").insert(rows.slice(i, i + BATCH));
        if (error) throw new Error(`Insert failed at row ${i}: ${error.message}`);
      }

      setStatus("done");
      setMessage(`Imported ${preview.length} transactions from ${file.name}.`);
      onComplete?.();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Insert failed.");
    }
  }

  function fmtCurrency(n: number): string {
    const sign = n < 0 ? "-" : "+";
    const abs = Math.abs(n);
    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-taupe-dark">
            Upload Statement
          </h3>
          {(status === "done" || status === "error") && (
            <button onClick={reset} className="text-xs text-taupe-dark underline hover:text-charcoal">
              Upload another
            </button>
          )}
        </div>

        {/* Format selector */}
        {status === "idle" && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-taupe-dark">Statement type</label>
            <div className="flex gap-2">
              {(["auto", "amex", "bank"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    format === f
                      ? "border-charcoal bg-charcoal text-ivory"
                      : "border-taupe text-taupe-dark hover:border-charcoal hover:text-charcoal"
                  }`}
                >
                  {f === "auto" ? "Auto-detect" : f === "amex" ? "AMEX" : "Bank"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File drop zone */}
        {status === "idle" && (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-taupe py-10 transition-colors hover:border-charcoal hover:bg-taupe-light/30">
            <FileSpreadsheet className="mb-2 h-5 w-5 text-taupe-dark" />
            <span className="text-sm font-medium text-charcoal">Choose Excel file</span>
            <span className="mt-1 text-xs text-taupe-dark">.xlsx, .xls, or .csv</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </label>
        )}

        {/* Account selection */}
        {status === "select-account" && (
          <div className="space-y-3">
            <p className="text-sm text-charcoal">Select the account for <strong>{file?.name}</strong>:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    if (file) parseFile(file, a.id);
                  }}
                  className="rounded-lg border border-taupe px-4 py-3 text-left transition-colors hover:border-charcoal hover:bg-taupe-light/30"
                >
                  <p className="text-sm font-medium text-charcoal">{a.name}</p>
                  <p className="text-xs text-taupe-dark">{a.account_type.replace("_", " ")}</p>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
          </div>
        )}

        {/* Parsing */}
        {status === "parsing" && (
          <div className="flex items-center gap-3 rounded-lg bg-taupe-light/40 px-4 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-charcoal" />
            <p className="text-sm text-charcoal">Parsing {file?.name}\u2026</p>
          </div>
        )}

        {/* Preview */}
        {status === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-charcoal">
                <strong>{preview.length}</strong> transactions found
                <span className="ml-2 rounded-full bg-taupe-light px-2 py-0.5 text-[10px] font-medium uppercase text-taupe-dark">
                  {detectedFormat}
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
                <Button size="sm" onClick={confirmInsert}>Import All</Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-taupe-light">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="sticky top-0 border-b border-taupe-light bg-ivory text-[10px] uppercase tracking-wide text-taupe-dark">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((tx, i) => (
                    <tr key={i} className="border-b border-taupe-light/50">
                      <td className="whitespace-nowrap px-3 py-2 text-charcoal">{tx.tx_date}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-charcoal">{tx.description}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium ${tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmtCurrency(tx.amount)}
                      </td>
                      <td className="px-3 py-2 text-taupe-dark">{tx.category ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 50 && (
                <p className="border-t border-taupe-light/50 px-3 py-2 text-center text-[10px] text-taupe-dark">
                  Showing 50 of {preview.length} transactions
                </p>
              )}
            </div>
          </div>
        )}

        {/* Inserting */}
        {status === "inserting" && (
          <div className="flex items-center gap-3 rounded-lg bg-taupe-light/40 px-4 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-charcoal" />
            <p className="text-sm text-charcoal">{message}</p>
          </div>
        )}

        {/* Done */}
        {status === "done" && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-4">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">{message}</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-4">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-900">Upload failed</p>
                <p className="mt-1 text-xs text-red-700">{message}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
