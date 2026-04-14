"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, RefreshCw, Key } from "lucide-react";

interface KlaviyoIntegrationProps {
  clientId: string;
  hasKey: boolean;
  lastSyncedAt: string | null;
}

export function KlaviyoIntegration({
  clientId,
  hasKey: initialHasKey,
  lastSyncedAt: initialLastSyncedAt,
}: KlaviyoIntegrationProps) {
  const router = useRouter();

  // Key state
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(initialLastSyncedAt);

  // Delete state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Save key ────────────────────────────────

  const handleSaveKey = useCallback(async () => {
    setKeyError(null);

    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setKeyError("API key is required");
      return;
    }
    if (!trimmed.startsWith("pk_")) {
      setKeyError("Key must start with pk_");
      return;
    }

    setSavingKey(true);
    try {
      const res = await fetch(`/api/klaviyo/key/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setKeyError(data.error ?? "Failed to save key");
        return;
      }

      setHasKey(true);
      setApiKeyInput("");
      router.refresh();
    } catch {
      setKeyError("Network error — try again");
    } finally {
      setSavingKey(false);
    }
  }, [apiKeyInput, clientId, router]);

  // ── Sync ────────────────────────────────────

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch(`/api/klaviyo/sync/${clientId}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok || res.status === 207) {
        const parts: string[] = [];
        if (data.campaigns_synced != null)
          parts.push(`${data.campaigns_synced} campaigns`);
        if (data.flows_synced != null)
          parts.push(`${data.flows_synced} flows`);
        if (data.duration_ms != null)
          parts.push(`${(data.duration_ms / 1000).toFixed(1)}s`);

        let message = `Synced ${parts.join(", ")}`;
        if (data.partial) {
          message += ` (partial — ${data.error})`;
        }

        setSyncResult({ type: "success", message });
        setLastSyncedAt(new Date().toISOString());
        router.refresh();
      } else {
        setSyncResult({
          type: "error",
          message: data.error ?? "Sync failed",
        });
      }
    } catch {
      setSyncResult({ type: "error", message: "Network error — try again" });
    } finally {
      setSyncing(false);
    }
  }, [clientId, router]);

  // ── Delete key ──────────────────────────────

  const handleDeleteKey = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/klaviyo/key/${clientId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHasKey(false);
        setLastSyncedAt(null);
        setConfirmingDelete(false);
        setSyncResult(null);
        router.refresh();
      }
    } catch {
      // silently fail, user can retry
    } finally {
      setDeleting(false);
    }
  }, [clientId, router]);

  // ── Relative time helper ────────────────────

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ── Render ──────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>Klaviyo</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasKey ? (
          /* ── State A: No key configured ──────────── */
          <div className="space-y-3">
            <p className="text-sm text-taupe-dark">
              Connect a Klaviyo account to sync campaigns and flows
              automatically.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="pk_live_..."
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setKeyError(null);
                }}
                disabled={savingKey}
                className="max-w-sm font-mono text-xs"
              />
              <Button
                onClick={handleSaveKey}
                disabled={savingKey || !apiKeyInput.trim()}
                size="sm"
              >
                {savingKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Key className="h-3.5 w-3.5" />
                )}
                Save API key
              </Button>
            </div>
            {keyError && (
              <p className="text-xs text-red-600">{keyError}</p>
            )}
            <p className="text-[11px] text-taupe">
              Private API key starts with <code className="font-mono">pk_</code>.
              Read-only scopes only. Stored encrypted in Vault.
            </p>
          </div>
        ) : (
          /* ── State B: Key configured ─────────────── */
          <div className="space-y-4">
            {/* Key display + sync info */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-mono text-xs text-taupe-dark">
                  pk_live_••••••••
                </p>
                {lastSyncedAt && (
                  <p className="text-[11px] text-taupe">
                    Last synced: {relativeTime(lastSyncedAt)}
                  </p>
                )}
                {!lastSyncedAt && (
                  <p className="text-[11px] text-taupe">Never synced</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  size="sm"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {syncing ? "Syncing..." : "Sync now"}
                </Button>

                {!confirmingDelete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmingDelete(true)}
                    title="Remove API key"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-taupe-dark" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteKey}
                      disabled={deleting}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Remove"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Sync result toast */}
            {syncResult && (
              <div
                className={`rounded-md px-3 py-2 text-xs ${
                  syncResult.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {syncResult.message}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
