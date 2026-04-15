"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCampaignFigmaUrl } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link as LinkIcon, Pencil, Trash2 } from "lucide-react";

interface FigmaDesignProps {
  campaignId: string;
  clientId: string;
  figmaUrl: string | null;
}

export function FigmaDesign({ campaignId, clientId, figmaUrl }: FigmaDesignProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const url = formData.get("figma_url") as string;
    startTransition(async () => {
      try {
        await setCampaignFigmaUrl(campaignId, url || null, clientId);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function handleRemove() {
    if (!confirm("Remove the linked Figma design?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await setCampaignFigmaUrl(campaignId, null, clientId);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  const showForm = !figmaUrl || editing;

  return (
    <div className="rounded-lg border border-taupe-light bg-white/60 px-5 py-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
        Design
      </h2>

      {/* ── Embed iframe when URL exists and not editing ── */}
      {figmaUrl && !editing && (
        <>
          <div className="rounded-lg border border-taupe-light/60 overflow-hidden">
            <iframe
              src={`https://www.figma.com/embed?embed_host=kdc&url=${encodeURIComponent(figmaUrl)}`}
              className="w-full h-[600px] border-0"
              allowFullScreen
              title="Figma design preview"
            />
          </div>
          <p className="mt-2 text-[11px] italic text-taupe">
            Make sure Figma sharing is set to &quot;Anyone with the link&quot; for the embed to render.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-[12px] text-taupe-dark truncate max-w-[400px]" title={figmaUrl}>
              Linked: {figmaUrl.length > 60 ? figmaUrl.slice(0, 60) + "\u2026" : figmaUrl}
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
          {!figmaUrl && !editing && (
            <p className="text-sm text-taupe-dark">
              Paste a Figma file or frame URL to preview the design here.
            </p>
          )}
          <form action={handleSubmit} className="flex gap-2">
            <Input
              name="figma_url"
              type="url"
              placeholder="Paste Figma URL..."
              defaultValue={figmaUrl ?? ""}
              disabled={pending}
              className="max-w-lg font-mono text-xs"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LinkIcon className="h-3.5 w-3.5" />
              )}
              {figmaUrl ? "Update" : "Link Figma design"}
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
