"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Pencil } from "lucide-react";

interface Brief {
  id: string;
  campaign_name: string | null;
  send_date: string | null;
  objective: string | null;
  creative_direction: string | null;
  product_story_direction: string | null;
  hypothesis: string | null;
  status: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  campaign_name: "",
  send_date: "",
  objective: "",
  creative_direction: "",
  product_story_direction: "",
  hypothesis: "",
  status: "draft",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-taupe-light text-taupe-dark",
  "in review": "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  sent: "bg-blue-100 text-blue-800",
};

function statusClass(s: string | null): string {
  return STATUS_COLORS[(s ?? "draft").toLowerCase()] ?? STATUS_COLORS.draft;
}

export function BriefsClient({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editBrief, setEditBrief] = useState<Brief | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const fetchBriefs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setBriefs(data ?? []);
    setLoading(false);
  }, [clientId, supabase]);

  useEffect(() => { fetchBriefs(); }, [fetchBriefs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("briefs").insert({
      client_id: clientId,
      campaign_name: form.campaign_name || null,
      send_date: form.send_date || null,
      objective: form.objective || null,
      creative_direction: form.creative_direction || null,
      product_story_direction: form.product_story_direction || null,
      hypothesis: form.hypothesis || null,
      status: form.status || "draft",
    });

    setSaving(false);
    if (!error) {
      setForm(EMPTY_FORM);
      setShowCreate(false);
      fetchBriefs();
    }
  }

  function openEdit(brief: Brief) {
    setEditBrief(brief);
    setEditForm({
      campaign_name: brief.campaign_name ?? "",
      send_date: brief.send_date ?? "",
      objective: brief.objective ?? "",
      creative_direction: brief.creative_direction ?? "",
      product_story_direction: brief.product_story_direction ?? "",
      hypothesis: brief.hypothesis ?? "",
      status: brief.status ?? "draft",
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editBrief) return;
    setSaving(true);

    const { error } = await supabase
      .from("briefs")
      .update({
        campaign_name: editForm.campaign_name || null,
        send_date: editForm.send_date || null,
        objective: editForm.objective || null,
        creative_direction: editForm.creative_direction || null,
        product_story_direction: editForm.product_story_direction || null,
        hypothesis: editForm.hypothesis || null,
        status: editForm.status || "draft",
      })
      .eq("id", editBrief.id);

    setSaving(false);
    if (!error) {
      setEditBrief(null);
      fetchBriefs();
    }
  }

  return (
    <>
      {/* Edit drawer/overlay */}
      {editBrief && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-charcoal/20" onClick={() => setEditBrief(null)} />
          <div className="relative w-full max-w-lg overflow-y-auto bg-ivory p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-charcoal">Edit Brief</h2>
              <button onClick={() => setEditBrief(null)} className="rounded p-1 hover:bg-taupe-light">
                <X className="h-4 w-4 text-taupe-dark" />
              </button>
            </div>
            <BriefForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={handleUpdate}
              saving={saving}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header row */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <X className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
            {showCreate ? "Cancel" : "New Brief"}
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <CardContent>
              <BriefForm
                form={form}
                setForm={setForm}
                onSubmit={handleCreate}
                saving={saving}
                submitLabel="Create Brief"
              />
            </CardContent>
          </Card>
        )}

        {/* Briefs list */}
        {loading ? (
          <p className="py-8 text-center text-sm text-taupe-dark">Loading…</p>
        ) : briefs.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-taupe-dark">
                No briefs yet. Click &quot;New Brief&quot; to create your first campaign brief.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {briefs.map((brief) => (
              <Card key={brief.id} className="group relative p-5 transition-colors hover:border-taupe">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-charcoal">
                          {brief.campaign_name ?? "Untitled Brief"}
                        </h3>
                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusClass(brief.status)}`}>
                          {brief.status ?? "draft"}
                        </span>
                      </div>

                      {brief.send_date && (
                        <p className="mt-1 text-xs text-taupe-dark">
                          Send date: {new Date(brief.send_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}

                      {brief.objective && (
                        <p className="mt-2 text-sm text-charcoal-light line-clamp-2">{brief.objective}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-taupe-dark">
                        {brief.creative_direction && (
                          <span><strong className="font-medium text-charcoal">Creative:</strong> {brief.creative_direction}</span>
                        )}
                        {brief.hypothesis && (
                          <span><strong className="font-medium text-charcoal">Hypothesis:</strong> {brief.hypothesis}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => openEdit(brief)}
                      className="shrink-0 rounded p-1.5 opacity-0 transition-opacity hover:bg-taupe-light group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-taupe-dark" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function BriefForm({
  form,
  setForm,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Campaign Name" value={form.campaign_name} onChange={(v) => setForm({ ...form, campaign_name: v })} />
        <Field label="Send Date" type="date" value={form.send_date} onChange={(v) => setForm({ ...form, send_date: v })} />
      </div>
      <TextArea label="Objective" value={form.objective} onChange={(v) => setForm({ ...form, objective: v })} />
      <TextArea label="Creative Direction" value={form.creative_direction} onChange={(v) => setForm({ ...form, creative_direction: v })} />
      <TextArea label="Product / Story Direction" value={form.product_story_direction} onChange={(v) => setForm({ ...form, product_story_direction: v })} />
      <TextArea label="Hypothesis" value={form.hypothesis} onChange={(v) => setForm({ ...form, hypothesis: v })} />
      <div>
        <label className="mb-1 block text-xs font-medium text-taupe-dark">Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="flex h-9 w-full rounded-md border border-taupe bg-white/80 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-charcoal"
        >
          <option value="draft">Draft</option>
          <option value="in review">In Review</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-taupe-dark">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-taupe-dark">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="flex w-full rounded-md border border-taupe bg-white/80 px-3 py-2 text-sm transition-colors placeholder:text-taupe focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-charcoal"
      />
    </div>
  );
}
