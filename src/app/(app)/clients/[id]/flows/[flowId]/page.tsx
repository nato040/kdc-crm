import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  fmtDate,
  fmtCount,
  fmtPct,
  fmtCurrency,
  fmtBool,
} from "../../_components/format";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 py-2">
      <dt className="w-44 shrink-0 text-[12px] font-medium uppercase tracking-wider text-taupe-dark">
        {label}
      </dt>
      <dd className="text-[13px] text-charcoal">{value}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-taupe-light bg-white/60 px-5 py-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
        {title}
      </h2>
      <dl className="divide-y divide-taupe-light/60">{children}</dl>
    </div>
  );
}

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string; flowId: string }>;
}) {
  const { id, flowId } = await params;
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from("flows_latest")
    .select("*")
    .eq("id", flowId)
    .single();

  if (!flow) notFound();

  return (
    <>
      <Link
        href={`/clients/${id}/flows`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-taupe-dark hover:text-charcoal transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to flows
      </Link>

      <PageHeader title={flow.flow_name ?? "Untitled Flow"} />

      <div className="space-y-6">
        <Section title="Identity">
          <Field label="Flow name" value={flow.flow_name ?? "\u2014"} />
          <Field label="Status" value={flow.flow_status ?? "\u2014"} />
          <Field label="Trigger type" value={flow.trigger_type ?? "\u2014"} />
          <Field label="Archived" value={fmtBool(flow.archived)} />
          <Field label="Created (Klaviyo)" value={fmtDate(flow.created_at_klaviyo, { includeTime: true })} />
          <Field label="Updated (Klaviyo)" value={fmtDate(flow.updated_at_klaviyo, { includeTime: true })} />
        </Section>

        <Section title="Engagement">
          <Field label="Recipients" value={fmtCount(flow.recipient_count)} />
          <Field label="Delivered" value={fmtCount(flow.delivered_count)} />
          <Field label="Opens (unique)" value={fmtCount(flow.opens_unique)} />
          <Field label="Clicks (unique)" value={fmtCount(flow.clicks_unique)} />
          <Field label="Open rate" value={fmtPct(flow.open_rate)} />
          <Field label="Click rate" value={fmtPct(flow.click_rate)} />
          <Field label="Bounce rate" value={fmtPct(flow.bounce_rate)} />
          <Field label="Unsubscribe rate" value={fmtPct(flow.unsubscribe_rate)} />
        </Section>

        <Section title="Revenue">
          <Field label="Conversions" value={fmtCount(flow.conversion_count)} />
          <Field label="Conversion value" value={fmtCurrency(flow.conversion_value)} />
          <Field label="Conversion rate" value={fmtPct(flow.conversion_rate)} />
          <Field label="Revenue / recipient" value={fmtCurrency(flow.revenue_per_recipient)} />
          <Field label="Avg order value" value={fmtCurrency(flow.average_order_value)} />
        </Section>

        <Section title="Snapshot metadata">
          <Field label="Synced at" value={fmtDate(flow.synced_at, { includeTime: true })} />
          <Field label="Period start" value={fmtDate(flow.period_start)} />
          <Field label="Period end" value={fmtDate(flow.period_end)} />
          <Field label="Run type" value={flow.run_type ?? "\u2014"} />
        </Section>
      </div>
    </>
  );
}
