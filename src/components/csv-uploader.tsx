"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface CSVUploaderProps {
  clientId: string;
  label: string;
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: (csvText: string, clientId: string) => any[];
}

export function CSVUploader({ clientId, label, table, parser }: CSVUploaderProps) {
  const [status, setStatus] = useState<"idle" | "parsing" | "inserting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("parsing");
    setMessage("");
    setRowCount(0);

    try {
      const text = await file.text();
      const rows = parser(text, clientId);

      if (rows.length === 0) {
        setStatus("error");
        setMessage("No valid data rows found in the CSV. Check that the file has the expected columns.");
        return;
      }

      setStatus("inserting");
      setMessage(`Parsed ${rows.length} rows. Inserting…`);

      const supabase = createClient();

      const BATCH = 500;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase.from(table).insert(batch);

        if (error) {
          setStatus("error");
          setMessage(`Insert failed at row ${i}: ${error.message}`);
          return;
        }

        inserted += batch.length;
      }

      setRowCount(inserted);
      setStatus("done");
      setMessage(`Successfully inserted ${inserted} rows.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error during parsing.");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setStatus("idle");
    setMessage("");
    setRowCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-taupe-dark">
            {label}
          </h3>
          {status === "done" && (
            <button onClick={reset} className="text-xs text-taupe-dark underline hover:text-charcoal">
              Upload another
            </button>
          )}
        </div>

        {status === "idle" && (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-taupe py-10 transition-colors hover:border-charcoal hover:bg-taupe-light/30">
            <Upload className="mb-2 h-5 w-5 text-taupe-dark" />
            <span className="text-sm font-medium text-charcoal">Choose CSV file</span>
            <span className="mt-1 text-xs text-taupe-dark">or drag and drop</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleChange}
            />
          </label>
        )}

        {(status === "parsing" || status === "inserting") && (
          <div className="flex items-center gap-3 rounded-lg bg-taupe-light/40 px-4 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-charcoal" />
            <p className="text-sm text-charcoal">
              {status === "parsing" ? "Parsing CSV…" : message}
            </p>
          </div>
        )}

        {status === "done" && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-4">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-900">{message}</p>
              <p className="mt-1 text-xs text-emerald-700">
                Reload the dashboard to see updated data.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-4">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-900">Upload failed</p>
                <p className="mt-1 text-xs text-red-700">{message}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
