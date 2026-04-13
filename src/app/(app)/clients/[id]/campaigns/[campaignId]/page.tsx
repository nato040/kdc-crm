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

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns_latest")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) notFound();

  return (
    <>
      <Link
        href={`/clients/${id}/campaigns`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-taupe-dark hover:text-charcoal transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to campaigns
      </Link>

      <PageHeader
        title={campaign.campaign_name ?? "Untitled Campaign"}
        description={campaign.subject_line ?? undefined}
      />

      <div className="space-y-6">
        <Section title="Identity">
          <Field label="Campaign name" value={campaign.campaign_name ?? "\u2014"} />
          <Field label="Subject line" value={campaign.subject_line ?? "\u2014"} />
          <Field label="Preview text" value={campaign.preview_text ?? "\u2014"} />
          <Field label="From email" value={campaign.from_email ?? "\u2014"} />
          <Field label="From label" value={campaign.from_label ?? "\u2014"} />
          <Field label="Send time" value={fmtDate(campaign.send_time, { includeTime: true })} />
          <Field label="Channel" value={campaign.channel ?? "\u2014"} />
          <Field label="Status" value={campaign.status ?? "\u2014"} />
          <Field label="Archived" value={fmtBool(campaign.archived)} />
        </Section>

        <Section title="Engagement">
          <Field label="Recipients" value={fmtCount(campaign.recipient_count)} />
          <Field label="Delivered" value={fmtCount(campaign.delivered_count)} />
          <Field label="Opens (unique)" value={fmtCount(campaign.opens_unique)} />
          <Field label="Clicks (unique)" value={fmtCount(campaign.clicks_unique)} />
          <Field label="Open rate" value={fmtPct(campaign.open_rate)} />
          <Field label="Click rate" value={fmtPct(campaign.click_rate)} />
          <Field label="Bounce rate" value={fmtPct(campaign.bounce_rate)} />
          <Field label="Unsubscribe rate" value={fmtPct(campaign.unsubscribe_rate)} />
        </Section>

        <Section title="Revenue">
          <Field label="Conversions" value={fmtCount(campaign.conversion_count)} />
          <Field label="Conversion value" value={fmtCurrency(campaign.conversion_value)} />
          <Field label="Conversion rate" value={fmtPct(campaign.conversion_rate)} />
          <Field label="Revenue / recipient" value={fmtCurrency(campaign.revenue_per_recipient)} />
          <Field label="Avg order value" value={fmtCurrency(campaign.average_order_value)} />
        </Section>

        <Section title="Snapshot metadata">
          <Field label="Synced at" value={fmtDate(campaign.synced_at, { includeTime: true })} />
          <Field label="Period start" value={fmtDate(campaign.period_start)} />
          <Field label="Period end" value={fmtDate(campaign.period_end)} />
          <Field label="Run type" value={campaign.run_type ?? "\u2014"} />
        </Section>
      </div>
    </>
  );
}
