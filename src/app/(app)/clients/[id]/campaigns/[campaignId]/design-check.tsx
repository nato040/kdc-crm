"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runDesignCheck } from "./design-check-action";
import { Loader2, ShieldCheck } from "lucide-react";

interface DesignCheckProps {
  campaignId: string;
  clientId: string;
  currentVerdict: string | null;
  currentReason: string | null;
  imageUrl: string | null;
}

export function DesignCheck({
  campaignId,
  clientId,
  currentVerdict,
  currentReason,
  imageUrl,
}: DesignCheckProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [verdict, setVerdict] = useState(currentVerdict);
  const [reason, setReason] = useState(currentReason);
  const [error, setError] = useState<string | null>(null);

  function handleRun() {
    setError(null);
    startTransition(async () => {
      const result = await runDesignCheck(campaignId, clientId);
      if (result.success) {
        setVerdict(result.verdict ?? null);
        setReason(result.reason ?? null);
        router.refresh();
      } else {
        setError(result.error ?? "Unknown error");
      }
    });
  }

  // No image uploaded — don't show anything
  if (!imageUrl) return null;

  return (
    <div className="rounded-lg border border-taupe-light bg-white/60 px-5 py-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
        Design Check
      </h2>

      {/* Verdict display */}
      {verdict && (
        <div className="mb-4">
          <span
            className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide ${
              verdict === "PASS"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {verdict}
          </span>
          {reason && (
            <p className="mt-2 text-[13px] text-charcoal leading-relaxed">
              {reason}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {!verdict && !pending && (
          <button
            onClick={handleRun}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded bg-charcoal px-4 py-2 text-[13px] font-medium text-ivory hover:bg-charcoal-light transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Run Design Check
          </button>
        )}

        {verdict && !pending && (
          <button
            onClick={handleRun}
            disabled={pending}
            className="text-[12px] text-taupe-dark underline hover:text-charcoal transition-colors"
          >
            Re-run check
          </button>
        )}

        {pending && (
          <div className="inline-flex items-center gap-2 text-[13px] text-taupe-dark">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing design against 7 standards...
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
