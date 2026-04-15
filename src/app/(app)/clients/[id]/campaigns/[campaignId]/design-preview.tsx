"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCampaignDesignUrl } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ImageIcon, Pencil, Trash2 } from "lucide-react";

interface DesignPreviewProps {
  campaignId: string;
  clientId: string;
  designUrl: string | null;
}

export function DesignPreview({ campaignId, clientId, designUrl }: DesignPreviewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const url = formData.get("design_url") as string;
    startTransition(async () => {
      try {
        await setCampaignDesignUrl(campaignId, url || null, clientId);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function handleRemove() {
    if (!confirm("Remove the linked design image?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await setCampaignDesignUrl(campaignId, null, clientId);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  const showForm = !designUrl || editing;

  return (
    <div className="rounded-lg border border-taupe-light bg-white/60 px-5 py-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
        Design
      </h2>

      {/* ── Image display when URL exists and not editing ── */}
      {designUrl && !editing && (
        <>
          <div className="rounded-lg border border-taupe-light/60 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={designUrl}
              alt="Email design preview"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-[12px] text-taupe-dark truncate max-w-[400px]" title={designUrl}>
              Linked: {designUrl.length > 60 ? designUrl.slice(0, 60) + "\u2026" : designUrl}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={pending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Remove
            </Button>
          </div>
        </>
      )}

      {/* ── Form: set or edit URL ── */}
      {showForm && (
        <div className="space-y-3">
          {!designUrl && !editing && (
            <p className="text-sm text-taupe-dark">
              Paste a direct image URL of the email design. Supports JPG, PNG, WebP.
            </p>
          )}
          <form action={handleSubmit} className="flex gap-2">
            <Input
              name="design_url"
              type="url"
              placeholder="Paste image URL (Imgur, Supabase Storage, etc.)"
              defaultValue={designUrl ?? ""}
              disabled={pending}
              className="max-w-lg font-mono text-xs"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              {designUrl ? "Update" : "Link design"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            )}
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
