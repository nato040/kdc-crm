"use client";

import { CSVUploader } from "@/components/csv-uploader";
import { parseCampaignCSV } from "@/lib/csv/parse-campaigns";
import { parseFlowCSV } from "@/lib/csv/parse-flows";

export function UploadsClient({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CSVUploader
        clientId={clientId}
        label="Upload Klaviyo Campaign CSV"
        table="campaign_performance"
        parser={parseCampaignCSV}
      />
      <CSVUploader
        clientId={clientId}
        label="Upload Klaviyo Flow CSV"
        table="flow_performance_daily"
        parser={parseFlowCSV}
      />
    </div>
  );
}
