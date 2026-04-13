import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { SortHeader } from "../_components/sort-header";
import { fmtDate, fmtCount, fmtPct, fmtCurrency, fmtText } from "../_components/format";

const SORTABLE_COLUMNS = new Set([
  "send_time",
  "campaign_name",
  "recipient_count",
  "open_rate",
  "click_rate",
  "conversion_count",
  "conversion_value",
  "revenue_per_recipient",
]);

const DEFAULT_SORT = "send_time";
const DEFAULT_DIR = "desc";

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, last_synced_at")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // Resolve sort params with whitelist
  const sortCol = sp.sort && SORTABLE_COLUMNS.has(sp.sort) ? sp.sort : DEFAULT_SORT;
  const sortDir = sp.dir === "asc" ? "asc" : DEFAULT_DIR;

  const { data: campaigns, count } = await supabase
    .from("campaigns_latest")
    .select("*", { count: "exact" })
    .eq("client_id", id)
    .order(sortCol, { ascending: sortDir === "asc", nullsFirst: false });

  const basePath = `/clients/${id}/campaigns`;
  const lastSynced = client.last_synced_at
    ? formatDistanceToNow(new Date(client.last_synced_at), { addSuffix: true })
    : null;

  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`${count ?? 0} campaigns${lastSynced ? ` \u00b7 Last synced ${lastSynced}` : ""}`}
      />

      {!campaigns || campaigns.length === 0 ? (
        <div className="rounded-lg border border-taupe-light bg-white/60 px-6 py-12 text-center">
          <p className="text-sm text-taupe-dark">
            No campaigns synced yet. Run a sync from the{" "}
            <Link href={`/clients/${id}/integrations`} className="underline hover:text-charcoal">
              Integrations tab
            </Link>{" "}
            to pull data from Klaviyo.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-taupe-light bg-white/60">
          <table className="w-full text-sm">
            <thead className="border-b border-taupe-light bg-white/80">
              <tr>
                <SortHeader label="Send date" column="send_time" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Ch</th>
                <SortHeader label="Campaign name" column="campaign_name" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Subject</th>
                <SortHeader label="Recipients" column="recipient_count" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Open %" column="open_rate" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Click %" column="click_rate" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Conv." column="conversion_count" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Revenue" column="conversion_value" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe-light/60">
              {campaigns.map((c) => {
                const name = fmtText(c.campaign_name, 50);
                const subject = fmtText(c.subject_line, 60);
                return (
                  <tr key={c.id} className="hover:bg-taupe-light/30 transition-colors">
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] text-charcoal">
                      {fmtDate(c.send_time)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        c.channel === "sms"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-taupe-light text-taupe-dark"
                      }`}>
                        {c.channel ?? "\u2014"}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-[13px] text-charcoal">
                      <Link
                        href={`/clients/${id}/campaigns/${c.id}`}
                        className="hover:underline"
                        title={name.full ?? undefined}
                      >
                        {name.display}
                      </Link>
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-[13px] text-taupe-dark" title={subject.full ?? undefined}>
                      {subject.display}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtCount(c.recipient_count)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct(c.open_rate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtPct(c.click_rate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtCount(c.conversion_count)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                      {fmtCurrency(c.conversion_value)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        c.status === "sent"
                          ? "bg-green-50 text-green-700"
                          : c.status === "draft"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-taupe-light text-taupe-dark"
                      }`}>
                        {c.status ?? "\u2014"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
