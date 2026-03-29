"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface AccountFormProps {
  onCreated?: () => void;
}

export function AccountForm({ onCreated }: AccountFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings" | "credit_card">("checking");
  const [lastFour, setLastFour] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.from("finance_accounts").insert({
      name: name.trim(),
      account_type: accountType,
      last_four: lastFour.trim() || null,
    });

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    setName("");
    setLastFour("");
    setOpen(false);
    onCreated?.();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-taupe-dark hover:text-charcoal"
      >
        <Plus className="h-3.5 w-3.5" />
        Add account
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-taupe-light bg-white/60 p-4 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-taupe-dark">Account name</label>
        <Input
          placeholder="e.g. AMEX Business Gold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-taupe-dark">Type</label>
          <div className="flex gap-1.5">
            {(["credit_card", "checking", "savings"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAccountType(t)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  accountType === t
                    ? "border-charcoal bg-charcoal text-ivory"
                    : "border-taupe text-taupe-dark hover:border-charcoal"
                }`}
              >
                {t === "credit_card" ? "Credit Card" : t === "checking" ? "Checking" : "Savings"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-taupe-dark">Last 4 digits</label>
          <Input
            placeholder="1234"
            maxLength={4}
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={saving}>
          {saving ? "Saving\u2026" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
