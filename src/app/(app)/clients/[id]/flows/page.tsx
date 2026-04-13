import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { SortHeader } from "../_components/sort-header";
import { fmtCount, fmtPct, fmtCurrency, fmtDate } from "../_components/format";

const SORTABLE_COLUMNS = new Set([
  "flow_name",
  "flow_status",
  "recipient_count",
  "open_rate",
  "click_rate",
  "conversion_count",
  "conversion_value",
]);

const DEFAULT_SORT = "flow_name";
const DEFAULT_DIR = "asc";

export default async function FlowsPage({
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

  const sortCol = sp.sort && SORTABLE_COLUMNS.has(sp.sort) ? sp.sort : DEFAULT_SORT;
  const sortDir = sp.dir === "desc" ? "desc" : DEFAULT_DIR;

  const { data: flows, count } = await supabase
    .from("flows_latest")
    .select("*", { count: "exact" })
    .eq("client_id", id)
    .order(sortCol, { ascending: sortDir === "asc", nullsFirst: false });

  const basePath = `/clients/${id}/flows`;
  const lastSynced = client.last_synced_at
    ? formatDistanceToNow(new Date(client.last_synced_at), { addSuffix: true })
    : null;

  return (
    <>
      <PageHeader
        title="Flows"
        description={`${count ?? 0} flows${lastSynced ? ` \u00b7 Last synced ${lastSynced}` : ""}`}
      />

      {!flows || flows.length === 0 ? (
        <div className="rounded-lg border border-taupe-light bg-white/60 px-6 py-12 text-center">
          <p className="text-sm text-taupe-dark">
            No flows synced yet. Run a sync from the{" "}
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
                <SortHeader label="Flow name" column="flow_name" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} />
                <SortHeader label="Status" column="flow_status" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Trigger</th>
                <SortHeader label="Recipients" column="recipient_count" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Open %" column="open_rate" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Click %" column="click_rate" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Conv." column="conversion_count" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <SortHeader label="Revenue" column="conversion_value" currentSort={sortCol} currentDir={sortDir as "asc" | "desc"} basePath={basePath} className="text-right" />
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-taupe-dark">Last synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe-light/60">
              {flows.map((f) => (
                <tr key={f.id} className="hover:bg-taupe-light/30 transition-colors">
                  <td className="px-3 py-2 text-[13px] text-charcoal">
                    <Link
                      href={`/clients/${id}/flows/${f.id}`}
                      className="hover:underline"
                    >
                      {f.flow_name ?? "\u2014"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      f.flow_status === "live"
                        ? "bg-green-50 text-green-700"
                        : f.flow_status === "draft"
                          ? "bg-yellow-50 text-yellow-700"
                          : f.flow_status === "manual"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-taupe-light text-taupe-dark"
                    }`}>
                      {f.flow_status ?? "\u2014"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[13px] text-taupe-dark">
                    {f.trigger_type ?? "\u2014"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                    {fmtCount(f.recipient_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                    {fmtPct(f.open_rate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                    {fmtPct(f.click_rate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                    {fmtCount(f.conversion_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-charcoal">
                    {fmtCurrency(f.conversion_value)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] tabular-nums text-taupe-dark">
                    {fmtDate(f.synced_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
