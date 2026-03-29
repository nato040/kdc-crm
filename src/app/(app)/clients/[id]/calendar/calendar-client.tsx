"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";

interface CalendarCampaign {
  id: string;
  send_date: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  primary_purpose: string | null;
  offer: string | null;
  hook: string | null;
  segment: string | null;
  strategy_notes: string | null;
}

const EMPTY_FORM = {
  send_date: "",
  campaign_name: "",
  campaign_type: "",
  primary_purpose: "",
  offer: "",
  hook: "",
  segment: "",
  strategy_notes: "",
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function CalendarClient({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<CalendarCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(monthKey(now));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const startDate = `${filterMonth}-01`;
    const [y, m] = filterMonth.split("-").map(Number);
    const endDate = `${y}-${String(m + 1).padStart(2, "0")}-01`;

    const { data } = await supabase
      .from("calendar_campaigns")
      .select("id, send_date, campaign_name, campaign_type, primary_purpose, offer, hook, segment, strategy_notes")
      .eq("client_id", clientId)
      .gte("send_date", startDate)
      .lt("send_date", endDate)
      .order("send_date", { ascending: true });

    setItems(data ?? []);
    setLoading(false);
  }, [clientId, filterMonth, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function shiftMonth(delta: number) {
    const [y, m] = filterMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setFilterMonth(monthKey(d));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("calendar_campaigns").insert({
      client_id: clientId,
      send_date: form.send_date || null,
      campaign_name: form.campaign_name || null,
      campaign_type: form.campaign_type || null,
      primary_purpose: form.primary_purpose || null,
      offer: form.offer || null,
      hook: form.hook || null,
      segment: form.segment || null,
      strategy_notes: form.strategy_notes || null,
    });

    setSaving(false);
    if (!error) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchData();
    }
  }

  function startEdit(item: CalendarCampaign) {
    setEditingId(item.id);
    setEditForm({
      send_date: item.send_date ?? "",
      campaign_name: item.campaign_name ?? "",
      campaign_type: item.campaign_type ?? "",
      primary_purpose: item.primary_purpose ?? "",
      offer: item.offer ?? "",
      hook: item.hook ?? "",
      segment: item.segment ?? "",
      strategy_notes: item.strategy_notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const { error } = await supabase
      .from("calendar_campaigns")
      .update({
        send_date: editForm.send_date || null,
        campaign_name: editForm.campaign_name || null,
        campaign_type: editForm.campaign_type || null,
        primary_purpose: editForm.primary_purpose || null,
        offer: editForm.offer || null,
        hook: editForm.hook || null,
        segment: editForm.segment || null,
        strategy_notes: editForm.strategy_notes || null,
      })
      .eq("id", editingId);

    if (!error) {
      setEditingId(null);
      fetchData();
    }
  }

  return (
    <div className="space-y-6">
      {/* Month navigation + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium text-charcoal">
            {monthLabel(filterMonth)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
          {showForm ? "Cancel" : "Add Campaign"}
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Send Date" type="date" value={form.send_date} onChange={(v) => setForm({ ...form, send_date: v })} />
                <Field label="Campaign Name" value={form.campaign_name} onChange={(v) => setForm({ ...form, campaign_name: v })} />
                <Field label="Campaign Type" value={form.campaign_type} onChange={(v) => setForm({ ...form, campaign_type: v })} />
                <Field label="Primary Purpose" value={form.primary_purpose} onChange={(v) => setForm({ ...form, primary_purpose: v })} />
                <Field label="Offer" value={form.offer} onChange={(v) => setForm({ ...form, offer: v })} />
                <Field label="Hook" value={form.hook} onChange={(v) => setForm({ ...form, hook: v })} />
                <Field label="Segment" value={form.segment} onChange={(v) => setForm({ ...form, segment: v })} />
                <Field label="Strategy Notes" value={form.strategy_notes} onChange={(v) => setForm({ ...form, strategy_notes: v })} />
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Add to Calendar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <p className="py-8 text-center text-sm text-taupe-dark">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-taupe-dark">
              No campaigns scheduled for {monthLabel(filterMonth)}. Click &quot;Add Campaign&quot; to plan a send.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe-light">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-taupe-light bg-taupe-light/30 text-xs uppercase tracking-wide text-taupe-dark">
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Campaign</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Purpose</th>
                <th className="px-3 py-2.5 font-medium">Offer</th>
                <th className="px-3 py-2.5 font-medium">Segment</th>
                <th className="px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="border-b border-taupe-light/50 bg-ivory/50">
                    <td className="px-2 py-1.5"><Input type="date" className="h-7 text-xs" value={editForm.send_date} onChange={(e) => setEditForm({ ...editForm, send_date: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={editForm.campaign_name} onChange={(e) => setEditForm({ ...editForm, campaign_name: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={editForm.campaign_type} onChange={(e) => setEditForm({ ...editForm, campaign_type: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={editForm.primary_purpose} onChange={(e) => setEditForm({ ...editForm, primary_purpose: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={editForm.offer} onChange={(e) => setEditForm({ ...editForm, offer: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={editForm.segment} onChange={(e) => setEditForm({ ...editForm, segment: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-7 text-xs" value={editForm.strategy_notes} onChange={(e) => setEditForm({ ...editForm, strategy_notes: e.target.value })} /></td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="rounded p-1 hover:bg-taupe-light"><Check className="h-3.5 w-3.5 text-emerald-600" /></button>
                        <button onClick={() => setEditingId(null)} className="rounded p-1 hover:bg-taupe-light"><X className="h-3.5 w-3.5 text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="border-b border-taupe-light/50 hover:bg-taupe-light/20">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-charcoal">{item.send_date ? new Date(item.send_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-charcoal">{item.campaign_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-taupe-dark">{item.campaign_type ?? "—"}</td>
                    <td className="px-3 py-2.5 text-taupe-dark">{item.primary_purpose ?? "—"}</td>
                    <td className="px-3 py-2.5 text-taupe-dark">{item.offer ?? "—"}</td>
                    <td className="px-3 py-2.5 text-taupe-dark">{item.segment ?? "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-taupe-dark">{item.strategy_notes ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => startEdit(item)} className="rounded p-1 hover:bg-taupe-light">
                        <Pencil className="h-3.5 w-3.5 text-taupe-dark" />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
