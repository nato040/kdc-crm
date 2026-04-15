-- 00009_design_check.sql
-- Adds AI design check fields to campaigns.
-- Stores the verdict (PASS/FAIL), one-line reason, and timestamp
-- from an AI evaluation of the email design against published standards.

ALTER TABLE campaigns
  ADD COLUMN design_check_verdict text CHECK (design_check_verdict IN ('PASS', 'FAIL')),
  ADD COLUMN design_check_reason text,
  ADD COLUMN design_check_at timestamptz;

COMMENT ON COLUMN campaigns.design_check_verdict IS 'AI-generated design evaluation: PASS or FAIL against published design standards.';
COMMENT ON COLUMN campaigns.design_check_reason IS 'One-line explanation of the verdict.';
COMMENT ON COLUMN campaigns.design_check_at IS 'Timestamp of when the design check was run.';

-- Recreate campaigns_latest view to include the three new columns.
-- Must DROP + CREATE because adding columns to an existing view requires it.
DROP VIEW IF EXISTS public.campaigns_latest;

CREATE VIEW public.campaigns_latest AS
SELECT DISTINCT ON (cs.campaign_id)
  c.id,
  c.client_id,
  c.klaviyo_id,
  c.channel,
  c.campaign_name,
  c.subject_line,
  c.preview_text,
  c.from_email,
  c.from_label,
  c.send_time,
  c.status,
  c.archived,
  c.figma_url,
  c.design_check_verdict,
  c.design_check_reason,
  c.design_check_at,
  cs.synced_at,
  cs.recipient_count,
  cs.delivered_count,
  cs.opens_unique,
  cs.clicks_unique,
  cs.open_rate,
  cs.click_rate,
  cs.bounce_rate,
  cs.unsubscribe_rate,
  cs.conversion_count,
  cs.conversion_value,
  cs.conversion_rate,
  cs.revenue_per_recipient,
  cs.average_order_value,
  cs.period_start,
  cs.period_end,
  cs.run_type
FROM public.campaigns c
LEFT JOIN public.campaign_snapshots cs ON cs.campaign_id = c.id
ORDER BY cs.campaign_id, cs.synced_at DESC;

-- Reload PostgREST schema cache so the API picks up new view columns immediately.
NOTIFY pgrst, 'reload schema';
