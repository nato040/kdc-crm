-- 00006_commission_statements.sql
-- Adds commission tracking for Cody's monthly invoicing workflow.
-- Matches her current Excel spreadsheet: flat 20% of campaign revenue
-- per month, with a daily credit-threshold test tracked as an
-- informational performance metric (not a payout input).
-- Additive only.

CREATE TABLE commission_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  campaigns_revenue numeric(12,2) NOT NULL,
  flows_revenue     numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate   numeric(5,4)  NOT NULL DEFAULT 0.2000,
  commission_amount numeric(12,2) NOT NULL,
  credits_earned    integer NOT NULL,
  credits_target    integer NOT NULL DEFAULT 100,
  daily_campaign_threshold numeric(12,2) NOT NULL DEFAULT 500.00,
  daily_combined_threshold numeric(12,2) NOT NULL DEFAULT 1000.00,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'invoiced', 'paid')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  approved_at  timestamptz,
  invoiced_at  timestamptz,
  paid_at      timestamptz,
  notes text,
  UNIQUE (client_id, period_start, period_end)
);

CREATE INDEX idx_commission_statements_client_period
  ON commission_statements (client_id, period_start DESC);

CREATE INDEX idx_commission_statements_status
  ON commission_statements (client_id, status)
  WHERE status IN ('draft', 'approved');

CREATE TABLE commission_credit_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES commission_statements(id) ON DELETE CASCADE,
  day date NOT NULL,
  campaigns_revenue numeric(12,2) NOT NULL,
  flows_revenue_allocated numeric(12,2) NOT NULL,
  total_revenue numeric(12,2) NOT NULL,
  passed_campaign_threshold boolean NOT NULL,
  passed_combined_threshold boolean NOT NULL,
  credit_earned boolean NOT NULL,
  UNIQUE (statement_id, day)
);

CREATE INDEX idx_commission_credit_days_statement
  ON commission_credit_days (statement_id, day);

ALTER TABLE commission_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_credit_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_statements_select ON commission_statements
  FOR SELECT USING (client_id IN (SELECT my_client_ids()));
CREATE POLICY commission_statements_insert ON commission_statements
  FOR INSERT WITH CHECK (client_id IN (SELECT my_client_ids()));
CREATE POLICY commission_statements_update ON commission_statements
  FOR UPDATE USING (client_id IN (SELECT my_client_ids()));

CREATE POLICY commission_credit_days_select ON commission_credit_days
  FOR SELECT USING (
    statement_id IN (
      SELECT id FROM commission_statements
      WHERE client_id IN (SELECT my_client_ids())
    )
  );
CREATE POLICY commission_credit_days_insert ON commission_credit_days
  FOR INSERT WITH CHECK (
    statement_id IN (
      SELECT id FROM commission_statements
      WHERE client_id IN (SELECT my_client_ids())
    )
  );
