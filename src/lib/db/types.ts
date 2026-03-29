// KDC CRM OS — MVP TypeScript types
// Matches 00001_schema.sql exactly.

export interface Client {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  created_at: string;
}

export interface UserClient {
  id: string;
  user_id: string;
  client_id: string;
  role: string;
  created_at: string;
}

export interface CampaignPerformance {
  id: string;
  client_id: string;
  campaign_name: string | null;
  send_date: string | null;
  campaign_type: string | null;
  segment: string | null;
  delivered: number;
  clicks: number;
  orders: number;
  revenue: number;
  ctr: number | null;
  cvr: number | null;
  rpr: number | null;
  aov: number | null;
  notes: string | null;
  created_at: string;
}

export interface FlowPerformanceDaily {
  id: string;
  client_id: string;
  day: string;
  flow_name: string | null;
  flow_message_name: string | null;
  delivered: number;
  clicks: number;
  orders: number;
  revenue: number;
  ctr: number | null;
  cvr: number | null;
  rpr: number | null;
  aov: number | null;
  created_at: string;
}

export interface MonthlyShopifySummary {
  id: string;
  client_id: string;
  month_start: string;
  total_revenue: number;
  orders: number | null;
  aov: number | null;
  created_at: string;
}

export interface MonthlyCrmSummary {
  id: string;
  client_id: string;
  month_start: string;
  campaign_revenue: number;
  flow_revenue: number;
  total_crm_revenue: number;
  total_delivered: number;
  total_crm_rpr: number | null;
  shopify_total_revenue: number | null;
  crm_percent_total_revenue: number | null;
  created_at: string;
}

export interface CalendarCampaign {
  id: string;
  client_id: string;
  send_date: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  primary_purpose: string | null;
  offer: string | null;
  hook: string | null;
  segment: string | null;
  strategy_notes: string | null;
  created_at: string;
}

export interface Brief {
  id: string;
  client_id: string;
  campaign_name: string | null;
  send_date: string | null;
  objective: string | null;
  creative_direction: string | null;
  product_story_direction: string | null;
  hypothesis: string | null;
  status: string | null;
  created_at: string;
}

// ── Finance ──────────────────────────────────

export interface FinanceAccount {
  id: string;
  name: string;
  account_type: "checking" | "savings" | "credit_card";
  last_four: string | null;
  created_at: string;
}

export interface StatementUpload {
  id: string;
  account_id: string;
  file_name: string;
  file_path: string | null;
  upload_month: string | null;
  row_count: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  statement_upload_id: string | null;
  tx_date: string;
  description: string | null;
  amount: number;
  category: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface Receipt {
  id: string;
  transaction_id: string | null;
  file_name: string;
  file_path: string;
  content_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}
