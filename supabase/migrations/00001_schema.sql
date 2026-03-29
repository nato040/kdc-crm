-- KDC CRM OS — MVP Schema
-- 8 tables, UUID PKs, client_id scoping, timestamps.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────
create table public.clients (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  industry   text,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- user_clients
-- ─────────────────────────────────────────────
create table public.user_clients (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  role       text not null default 'viewer',
  created_at timestamptz not null default now(),
  unique(user_id, client_id)
);

create index idx_uc_user   on public.user_clients(user_id);
create index idx_uc_client on public.user_clients(client_id);

-- ─────────────────────────────────────────────
-- campaign_performance
-- ─────────────────────────────────────────────
create table public.campaign_performance (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  campaign_name text,
  send_date     date,
  campaign_type text,
  segment       text,
  delivered     numeric not null default 0,
  clicks        numeric not null default 0,
  orders        numeric not null default 0,
  revenue       numeric not null default 0,
  ctr           numeric,
  cvr           numeric,
  rpr           numeric,
  aov           numeric,
  notes         text,
  created_at    timestamptz not null default now()
);

create index idx_cp_client on public.campaign_performance(client_id);
create index idx_cp_date   on public.campaign_performance(send_date);

-- ─────────────────────────────────────────────
-- flow_performance_daily
-- ─────────────────────────────────────────────
create table public.flow_performance_daily (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  day               date not null,
  flow_name         text,
  flow_message_name text,
  delivered         numeric not null default 0,
  clicks            numeric not null default 0,
  orders            numeric not null default 0,
  revenue           numeric not null default 0,
  ctr               numeric,
  cvr               numeric,
  rpr               numeric,
  aov               numeric,
  created_at        timestamptz not null default now()
);

create index idx_fpd_client on public.flow_performance_daily(client_id);
create index idx_fpd_day    on public.flow_performance_daily(day);

-- ─────────────────────────────────────────────
-- monthly_shopify_summary
-- ─────────────────────────────────────────────
create table public.monthly_shopify_summary (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  month_start   date not null,
  total_revenue numeric not null default 0,
  orders        numeric,
  aov           numeric,
  created_at    timestamptz not null default now(),
  unique(client_id, month_start)
);

create index idx_mss_client on public.monthly_shopify_summary(client_id);

-- ─────────────────────────────────────────────
-- monthly_crm_summary
-- ─────────────────────────────────────────────
create table public.monthly_crm_summary (
  id                       uuid primary key default uuid_generate_v4(),
  client_id                uuid not null references public.clients(id) on delete cascade,
  month_start              date not null,
  campaign_revenue         numeric not null default 0,
  flow_revenue             numeric not null default 0,
  total_crm_revenue        numeric not null default 0,
  total_delivered           numeric not null default 0,
  total_crm_rpr            numeric,
  shopify_total_revenue    numeric,
  crm_percent_total_revenue numeric,
  created_at               timestamptz not null default now(),
  unique(client_id, month_start)
);

create index idx_mcs_client on public.monthly_crm_summary(client_id);

-- ─────────────────────────────────────────────
-- calendar_campaigns
-- ─────────────────────────────────────────────
create table public.calendar_campaigns (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  send_date       date,
  campaign_name   text,
  campaign_type   text,
  primary_purpose text,
  offer           text,
  hook            text,
  segment         text,
  strategy_notes  text,
  created_at      timestamptz not null default now()
);

create index idx_cc_client on public.calendar_campaigns(client_id);
create index idx_cc_date   on public.calendar_campaigns(send_date);

-- ─────────────────────────────────────────────
-- briefs
-- ─────────────────────────────────────────────
create table public.briefs (
  id                      uuid primary key default uuid_generate_v4(),
  client_id               uuid not null references public.clients(id) on delete cascade,
  campaign_name           text,
  send_date               date,
  objective               text,
  creative_direction      text,
  product_story_direction text,
  hypothesis              text,
  status                  text,
  created_at              timestamptz not null default now()
);

create index idx_briefs_client on public.briefs(client_id);

-- ─────────────────────────────────────────────
-- RLS: enable on all, simple client_id scoping
-- ─────────────────────────────────────────────

alter table public.clients enable row level security;
alter table public.user_clients enable row level security;
alter table public.campaign_performance enable row level security;
alter table public.flow_performance_daily enable row level security;
alter table public.monthly_shopify_summary enable row level security;
alter table public.monthly_crm_summary enable row level security;
alter table public.calendar_campaigns enable row level security;
alter table public.briefs enable row level security;

-- helper: current user's client ids
create or replace function public.my_client_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select client_id from public.user_clients where user_id = auth.uid() $$;

-- clients
create policy "read own clients" on public.clients
  for select using (id in (select public.my_client_ids()));

-- user_clients
create policy "read own memberships" on public.user_clients
  for select using (user_id = auth.uid());

-- all data tables: select where client_id in user's clients
create policy "read" on public.campaign_performance    for select using (client_id in (select public.my_client_ids()));
create policy "read" on public.flow_performance_daily  for select using (client_id in (select public.my_client_ids()));
create policy "read" on public.monthly_shopify_summary for select using (client_id in (select public.my_client_ids()));
create policy "read" on public.monthly_crm_summary    for select using (client_id in (select public.my_client_ids()));
create policy "read" on public.calendar_campaigns      for select using (client_id in (select public.my_client_ids()));
create policy "read" on public.briefs                  for select using (client_id in (select public.my_client_ids()));

-- all data tables: insert where client_id in user's clients
create policy "insert" on public.campaign_performance    for insert with check (client_id in (select public.my_client_ids()));
create policy "insert" on public.flow_performance_daily  for insert with check (client_id in (select public.my_client_ids()));
create policy "insert" on public.monthly_shopify_summary for insert with check (client_id in (select public.my_client_ids()));
create policy "insert" on public.monthly_crm_summary    for insert with check (client_id in (select public.my_client_ids()));
create policy "insert" on public.calendar_campaigns      for insert with check (client_id in (select public.my_client_ids()));
create policy "insert" on public.briefs                  for insert with check (client_id in (select public.my_client_ids()));

-- all data tables: update where client_id in user's clients
create policy "update" on public.campaign_performance    for update using (client_id in (select public.my_client_ids()));
create policy "update" on public.flow_performance_daily  for update using (client_id in (select public.my_client_ids()));
create policy "update" on public.monthly_shopify_summary for update using (client_id in (select public.my_client_ids()));
create policy "update" on public.monthly_crm_summary    for update using (client_id in (select public.my_client_ids()));
create policy "update" on public.calendar_campaigns      for update using (client_id in (select public.my_client_ids()));
create policy "update" on public.briefs                  for update using (client_id in (select public.my_client_ids()));

-- all data tables: delete where client_id in user's clients
create policy "delete" on public.campaign_performance    for delete using (client_id in (select public.my_client_ids()));
create policy "delete" on public.flow_performance_daily  for delete using (client_id in (select public.my_client_ids()));
create policy "delete" on public.monthly_shopify_summary for delete using (client_id in (select public.my_client_ids()));
create policy "delete" on public.monthly_crm_summary    for delete using (client_id in (select public.my_client_ids()));
create policy "delete" on public.calendar_campaigns      for delete using (client_id in (select public.my_client_ids()));
create policy "delete" on public.briefs                  for delete using (client_id in (select public.my_client_ids()));
