"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Camera,
} from "lucide-react";

interface ReceiptUploaderProps {
  onComplete?: () => void;
}

type Status = "idle" | "uploading" | "done" | "error";

export function ReceiptUploader({ onComplete }: ReceiptUploaderProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStatus("idle");
    setMessage("");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      setStatus("error");
      setMessage("File too large. Maximum size is 10 MB.");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setStatus("error");
      setMessage("Unsupported file type. Upload a JPEG, PNG, WebP, HEIC, or PDF.");
      return;
    }

    setStatus("uploading");
    setMessage("Uploading receipt\u2026");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const ts = Date.now();
      const ext = file.name.split(".").pop() ?? "bin";
      const storagePath = `${user?.id ?? "anon"}/${ts}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from("receipts")
        .upload(storagePath, file, { contentType: file.type });

      if (storageErr) throw new Error(`Storage: ${storageErr.message}`);

      const { error: dbErr } = await supabase.from("receipts").insert({
        file_name: file.name,
        file_path: storagePath,
        content_type: file.type,
        notes: notes.trim() || null,
        uploaded_by: user?.id ?? null,
      });

      if (dbErr) throw new Error(dbErr.message);

      setStatus("done");
      setMessage(`Receipt "${file.name}" uploaded successfully.`);
      onComplete?.();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-taupe-dark">
            Upload Receipt
          </h3>
          {(status === "done" || status === "error") && (
            <button onClick={reset} className="text-xs text-taupe-dark underline hover:text-charcoal">
              Upload another
            </button>
          )}
        </div>

        {status === "idle" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-taupe-dark">Notes (optional)</label>
              <Input
                placeholder="e.g. Dinner with client, software subscription\u2026"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition-colors ${
                dragActive
                  ? "border-charcoal bg-taupe-light/40"
                  : "border-taupe hover:border-charcoal hover:bg-taupe-light/30"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <Camera className="mb-2 h-5 w-5 text-taupe-dark" />
              <span className="text-sm font-medium text-charcoal">Choose image or PDF</span>
              <span className="mt-1 text-xs text-taupe-dark">JPEG, PNG, WebP, HEIC, or PDF (max 10 MB)</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
        )}

        {status === "uploading" && (
          <div className="flex items-center gap-3 rounded-lg bg-taupe-light/40 px-4 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-charcoal" />
            <p className="text-sm text-charcoal">{message}</p>
          </div>
        )}

        {status === "done" && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-4">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">{message}</p>
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
            <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
