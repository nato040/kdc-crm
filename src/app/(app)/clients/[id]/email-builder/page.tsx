import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  fmtDate,
  fmtCount,
  fmtPct,
  fmtCurrency,
  fmtRpr,
} from "../_components/format";

const TIMEZONE = "America/New_York";

function fmtDateET(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function EmailBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // Single query — group in TypeScript
  const { data: campaigns } = await supabase
    .from("campaigns_latest")
    .select("*")
    .eq("client_id", id)
    .order("send_time", { ascending: false, nullsFirst: true });

  const all = campaigns ?? [];

  // Section 1: design uploaded, not yet sent (drafts)
  const designsInProgress = all.filter(
    (c) => c.figma_url != null && c.send_time == null
  );

  // Section 2: design uploaded AND sent
  const sentWithDesign = all.filter(
    (c) => c.figma_url != null && c.send_time != null
  );

  // Section 3: no design linked
  const withoutDesign = all.filter((c) => c.figma_url == null);

  return (
    <>
      <PageHeader
        title="Email Builder"
        description="Design in Figma. Build in Klaviyo. Measure here."
      />

      <div className="space-y-8">
        {/* ── Section 1: Designs in progress ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
            Designs in progress
          </h2>

          {designsInProgress.length === 0 ? (
            <p className="text-sm text-taupe-dark">
              No designs in progress. Add a design image to a draft campaign to
              see it here.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {designsInProgress.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-taupe-light/60 bg-white/80 p-4"
                >
                  <div className="mb-3 overflow-hidden rounded border border-taupe-light/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.figma_url!}
                      alt={`Design preview for ${c.campaign_name ?? "campaign"}`}
                      className="h-[120px] w-full object-contain bg-gray-50"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-[13px] font-medium text-charcoal truncate">
                    {c.campaign_name ?? "Untitled"}
                  </p>
                  <p className="mt-1 text-[11px] text-taupe-dark">
                    Designed &mdash; ready to build in Klaviyo
                  </p>
                  <Link
                    href={`/clients/${id}/campaigns/${c.id}`}
                    className="mt-2 inline-block text-[12px] font-medium text-charcoal underline hover:text-taupe-dark transition-colors"
                  >
                    View design
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 2: Sent campaigns with linked designs ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
            Sent campaigns with linked designs
          </h2>

          {sentWithDesign.length === 0 ? (
            <p className="text-sm text-taupe-dark">
              No sent campaigns with linked designs yet. Once a designed
              campaign is sent, you&apos;ll see its performance here.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sentWithDesign.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-taupe-light/60 bg-white/80 p-4"
                >
                  <div className="mb-3 overflow-hidden rounded border border-taupe-light/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.figma_url!}
                      alt={`Design preview for ${c.campaign_name ?? "campaign"}`}
                      className="h-[120px] w-full object-contain bg-gray-50"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-[13px] font-medium text-charcoal truncate">
                    {c.campaign_name ?? "Untitled"}
                  </p>
                  <p className="mt-1 text-[11px] text-taupe-dark">
                    Sent {fmtDateET(c.send_time)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums text-taupe-dark">
                    <span>{fmtCount(c.recipient_count)} recip</span>
                    <span>{fmtPct(c.open_rate)} open</span>
                    <span>{fmtPct(c.click_rate)} click</span>
                    <span>{fmtRpr(c.revenue_per_recipient)} RPR</span>
                    <span>{fmtCurrency(c.conversion_value)} rev</span>
                  </div>
                  <Link
                    href={`/clients/${id}/campaigns/${c.id}`}
                    className="mt-2 inline-block text-[12px] font-medium text-charcoal underline hover:text-taupe-dark transition-colors"
                  >
                    View design + metrics
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Campaigns without linked designs (collapsed) ── */}
        <div className="rounded-lg border border-taupe-light bg-white/60 px-8 py-8">
          <details>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.15em] text-taupe hover:text-taupe-dark transition-colors">
              Campaigns without linked designs ({withoutDesign.length})
            </summary>
            <div className="mt-4 divide-y divide-taupe-light/60">
              {withoutDesign.length === 0 ? (
                <p className="text-sm text-taupe-dark py-2">
                  All campaigns have linked designs.
                </p>
              ) : (
                withoutDesign.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2"
                  >
                    <Link
                      href={`/clients/${id}/campaigns/${c.id}`}
                      className="text-[13px] text-charcoal hover:underline truncate max-w-[60%]"
                    >
                      {c.campaign_name ?? "Untitled"}
                    </Link>
                    <span className="text-[12px] tabular-nums text-taupe-dark">
                      {fmtDateET(c.send_time)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
