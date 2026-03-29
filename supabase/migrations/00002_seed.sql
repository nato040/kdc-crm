-- KDC CRM OS — seed data
-- Demo client: 90 Degree by Reflex

-- client
insert into public.clients (id, name, industry, status) values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '90 Degree by Reflex', 'Activewear / DTC', 'active');

-- campaign_performance (Feb 2025 sample)
insert into public.campaign_performance
  (client_id, campaign_name, send_date, campaign_type, segment, delivered, clicks, orders, revenue, ctr, cvr, rpr, aov, notes)
values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'Valentine''s Day Sale',        '2025-02-12', 'promotional', 'Engaged 30d',    85420, 3417, 171, 12825.00, 0.0400, 0.0500, 0.1501, 75.00, null),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'New Arrivals — Spring Drop',   '2025-02-18', 'segmented',   'VIP Customers',  42300, 2538, 203, 18270.00, 0.0600, 0.0800, 0.4320, 90.00, 'Strong AOV'),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'Presidents Day Flash Sale',    '2025-02-17', 'promotional', 'All Subscribers', 120000, 4800, 288, 20160.00, 0.0400, 0.0600, 0.1680, 70.00, null),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'Educational — Fabric Guide',   '2025-02-21', 'educational', 'Engaged 90d',    65000, 1950, 52, 3640.00, 0.0300, 0.0267, 0.0560, 70.00, null),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'Feb Restock Alert',            '2025-02-26', 'segmented',   'Browse Abandon', 38000, 1900, 133, 9310.00, 0.0500, 0.0700, 0.2450, 70.00, null);

-- flow_performance_daily (sample days)
insert into public.flow_performance_daily
  (client_id, day, flow_name, flow_message_name, delivered, clicks, orders, revenue, ctr, cvr, rpr, aov)
values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 'Welcome Series',        'Welcome #1',       320, 96, 19, 1330.00, 0.3000, 0.1979, 4.1563, 70.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 'Welcome Series',        'Welcome #2',       280, 56, 8,  560.00, 0.2000, 0.1429, 2.0000, 70.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 'Abandoned Cart',        'Cart Reminder',    410, 123, 41, 3075.00, 0.3000, 0.3333, 7.5000, 75.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 'Post-Purchase',         'Review Request',   190, 19, 2,  150.00, 0.1000, 0.1053, 0.7895, 75.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 'Browse Abandonment',    'Browse Reminder',  250, 50, 10, 700.00, 0.2000, 0.2000, 2.8000, 70.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-15', 'Welcome Series',        'Welcome #1',       295, 89, 18, 1260.00, 0.3017, 0.2022, 4.2712, 70.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-15', 'Abandoned Cart',        'Cart Reminder',    380, 114, 38, 2850.00, 0.3000, 0.3333, 7.5000, 75.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-15', 'Browse Abandonment',    'Browse Reminder',  220, 44, 9,  630.00, 0.2000, 0.2045, 2.8636, 70.00);

-- monthly_shopify_summary
insert into public.monthly_shopify_summary
  (client_id, month_start, total_revenue, orders, aov)
values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-01-01', 285000.00, 3800, 75.00),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 310000.00, 4133, 75.00);

-- monthly_crm_summary
insert into public.monthly_crm_summary
  (client_id, month_start, campaign_revenue, flow_revenue, total_crm_revenue, total_delivered, total_crm_rpr, shopify_total_revenue, crm_percent_total_revenue)
values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-02-01', 64205.00, 10555.00, 74760.00, 352220, 0.2123, 310000.00, 0.2412);

-- calendar_campaigns (March 2025 plan)
insert into public.calendar_campaigns
  (client_id, send_date, campaign_name, campaign_type, primary_purpose, offer, hook, segment, strategy_notes)
values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-03-04', 'Spring Collection Launch',  'segmented',   'promotional', '15% off new arrivals', 'Fresh fits for spring',       'VIP Customers',   'Lead with hero product'),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-03-08', 'IWD Feature — Athletes',    'broadcast',   'engagement',  null,                   'Women who move',              'All Subscribers',  'Brand story angle'),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-03-13', 'Mid-March Restock',         'segmented',   'promotional', 'Back in stock',         'Your favorites are back',     'Engaged 30d',      null),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-03-20', 'Spring Cleaning Sale',      'broadcast',   'promotional', 'Up to 40% off',         'Out with the old',            'All Subscribers',  'Clearance push'),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', '2025-03-27', 'Educational — Layering',    'segmented',   'educational', null,                   'How to layer activewear',     'Engaged 90d',      'Content play');

-- briefs (March 2025)
insert into public.briefs
  (client_id, campaign_name, send_date, objective, creative_direction, product_story_direction, hypothesis, status)
values
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'Spring Collection Launch',  '2025-03-04', 'Drive VIP revenue on new spring line',            'Clean lifestyle imagery, outdoor setting',    'High-waist leggings + matching sports bra', 'VIP segment will convert at 8%+ CVR with new product imagery', 'approved'),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'IWD Feature — Athletes',    '2025-03-08', 'Brand engagement and social sharing',             'Documentary-style athlete portraits',         'Feature 3 brand athletes and their routines', 'Engagement rate 2x vs standard promotional sends', 'draft'),
  ('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', 'Spring Cleaning Sale',      '2025-03-20', 'Clear winter inventory, drive volume',            'Bold typography, urgency cues, countdown',    'End-of-season styles, deep discounts',       'Broad list + deep discount = high volume, lower AOV', 'draft');
