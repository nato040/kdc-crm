-- 00008_campaign_figma_url.sql
-- Add figma_url field to campaigns for inline design review.
-- Nullable: not all campaigns have a linked Figma design.
-- No RLS changes needed: existing campaign policies cover this column.

ALTER TABLE campaigns
  ADD COLUMN figma_url text;

-- Optional: simple format validation. Figma URLs follow patterns like:
--   https://www.figma.com/file/...
--   https://www.figma.com/design/...
--   https://www.figma.com/proto/...
-- Don't enforce a strict pattern in DB — that's brittle. Validate in application layer.

COMMENT ON COLUMN campaigns.figma_url IS 'Optional Figma design URL for inline preview in CRM. Set by admin via campaign detail page.';

-- Recreate campaigns_latest view to include figma_url.
-- The view uses explicit column names, so new columns must be added manually.
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
