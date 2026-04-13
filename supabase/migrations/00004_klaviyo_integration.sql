-- KDC CRM OS — Klaviyo API Integration v1
-- New tables for API-synced Klaviyo data (Option B).
-- Existing campaign_performance / flow_performance_daily untouched.
-- Engagement metrics stored as append-only snapshots (CTO directive).

-- ═════════════════════════════════════════════
-- 0. Vault extension (encrypted API key storage)
-- ═════════════════════════════════════════════

create extension if not exists supabase_vault;

-- ═════════════════════════════════════════════
-- 1. clients — add Vault FK + last sync timestamp
-- ═════════════════════════════════════════════

alter table public.clients
  add column if not exists klaviyo_key_id uuid,
  add column if not exists last_synced_at timestamptz;

-- ═════════════════════════════════════════════
-- 2. Vault helper functions (service-role only)
-- ═════════════════════════════════════════════

-- set_klaviyo_key: inserts or updates a client's Klaviyo API key in Vault
create or replace function public.set_klaviyo_key(
  p_client_id uuid,
  p_api_key   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_key_id uuid;
  v_new_key_id      uuid;
begin
  -- Check if client already has a key
  select klaviyo_key_id into v_existing_key_id
  from public.clients
  where id = p_client_id;

  if v_existing_key_id is not null then
    -- Update existing vault secret in place
    perform vault.update_secret(
      v_existing_key_id,
      p_api_key,
      'klaviyo_' || p_client_id::text,
      'Klaviyo API key for client ' || p_client_id::text
    );
  else
    -- Insert new vault secret
    v_new_key_id := vault.create_secret(
      p_api_key,
      'klaviyo_' || p_client_id::text,
      'Klaviyo API key for client ' || p_client_id::text
    );

    -- Store the vault secret ID on the client row
    update public.clients
    set klaviyo_key_id = v_new_key_id
    where id = p_client_id;
  end if;
end;
$$;

-- get_klaviyo_key: retrieves decrypted key for a client
create or replace function public.get_klaviyo_key(
  p_client_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_id uuid;
  v_decrypted text;
begin
  select klaviyo_key_id into v_key_id
  from public.clients
  where id = p_client_id;

  if v_key_id is null then
    return null;
  end if;

  select decrypted_secret into v_decrypted
  from vault.decrypted_secrets
  where id = v_key_id;

  return v_decrypted;
end;
$$;

-- Lock both functions to service role only
revoke execute on function public.set_klaviyo_key(uuid, text) from anon;
revoke execute on function public.set_klaviyo_key(uuid, text) from authenticated;
revoke execute on function public.get_klaviyo_key(uuid) from anon;
revoke execute on function public.get_klaviyo_key(uuid) from authenticated;

-- ═════════════════════════════════════════════
-- 3. campaigns — API-synced campaign identity
-- ═════════════════════════════════════════════

create table public.campaigns (
  id                uuid        primary key default uuid_generate_v4(),
  client_id         uuid        not null references public.clients(id) on delete cascade,
  klaviyo_id        text        not null,
  channel           text        not null,  -- 'email' | 'sms'
  campaign_name     text,
  subject_line      text,
  preview_text      text,
  from_email        text,
  from_label        text,
  send_time         timestamptz,
  status            text,                  -- Draft | Scheduled | Sent | Cancelled
  archived          boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint uq_campaigns_client_klaviyo unique (client_id, klaviyo_id)
);

create index idx_campaigns_client on public.campaigns(client_id);
create index idx_campaigns_send_time on public.campaigns(send_time);

-- ═════════════════════════════════════════════
-- 4. campaign_snapshots — append-only metrics per sync
-- ═════════════════════════════════════════════

create table public.campaign_snapshots (
  id                    uuid          primary key default uuid_generate_v4(),
  campaign_id           uuid          not null references public.campaigns(id) on delete cascade,
  synced_at             timestamptz   not null default now(),
  recipient_count       int,
  delivered_count        int,
  opens_unique          int,
  clicks_unique         int,
  open_rate             numeric(6,4),
  click_rate            numeric(6,4),
  bounce_rate           numeric(6,4),
  unsubscribe_rate      numeric(6,4),
  conversion_count      int,                  -- placed order count
  conversion_value      numeric(12,2),        -- revenue from placed orders
  conversion_rate       numeric(6,4),
  revenue_per_recipient numeric(12,4),
  average_order_value   numeric(12,2)
);

-- Composite index: covers the distinct-on ordering in campaigns_latest view
create index idx_cs_campaign_synced on public.campaign_snapshots(campaign_id, synced_at desc);

-- ═════════════════════════════════════════════
-- 5. flows — API-synced flow identity
-- ═════════════════════════════════════════════

create table public.flows (
  id                  uuid        primary key default uuid_generate_v4(),
  client_id           uuid        not null references public.clients(id) on delete cascade,
  klaviyo_id          text        not null,
  flow_name           text,
  flow_status         text,       -- draft | manual | live
  trigger_type        text,
  archived            boolean     not null default false,
  created_at_klaviyo  timestamptz,
  updated_at_klaviyo  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint uq_flows_client_klaviyo unique (client_id, klaviyo_id)
);

create index idx_flows_client on public.flows(client_id);

-- ═════════════════════════════════════════════
-- 6. flow_snapshots — append-only metrics per sync
-- ═════════════════════════════════════════════

create table public.flow_snapshots (
  id                    uuid          primary key default uuid_generate_v4(),
  flow_id               uuid          not null references public.flows(id) on delete cascade,
  synced_at             timestamptz   not null default now(),
  recipient_count       int,
  delivered_count        int,
  opens_unique          int,
  clicks_unique         int,
  open_rate             numeric(6,4),
  click_rate            numeric(6,4),
  bounce_rate           numeric(6,4),
  unsubscribe_rate      numeric(6,4),
  conversion_count      int,
  conversion_value      numeric(12,2),
  conversion_rate       numeric(6,4),
  revenue_per_recipient numeric(12,4),
  average_order_value   numeric(12,2)
);

-- Composite index: covers the distinct-on ordering in flows_latest view
create index idx_fs_flow_synced on public.flow_snapshots(flow_id, synced_at desc);

-- ═════════════════════════════════════════════
-- 7. Views — latest snapshot per campaign/flow
-- ═════════════════════════════════════════════

create or replace view public.campaigns_latest as
select distinct on (cs.campaign_id)
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
  cs.average_order_value
from public.campaigns c
left join public.campaign_snapshots cs on cs.campaign_id = c.id
order by cs.campaign_id, cs.synced_at desc;

create or replace view public.flows_latest as
select distinct on (fs.flow_id)
  f.id,
  f.client_id,
  f.klaviyo_id,
  f.flow_name,
  f.flow_status,
  f.trigger_type,
  f.archived,
  f.created_at_klaviyo,
  f.updated_at_klaviyo,
  fs.synced_at,
  fs.recipient_count,
  fs.delivered_count,
  fs.opens_unique,
  fs.clicks_unique,
  fs.open_rate,
  fs.click_rate,
  fs.bounce_rate,
  fs.unsubscribe_rate,
  fs.conversion_count,
  fs.conversion_value,
  fs.conversion_rate,
  fs.revenue_per_recipient,
  fs.average_order_value
from public.flows f
left join public.flow_snapshots fs on fs.flow_id = f.id
order by fs.flow_id, fs.synced_at desc;

-- ═════════════════════════════════════════════
-- 8. sync_runs — log every sync attempt
-- ═════════════════════════════════════════════

create table public.sync_runs (
  id               uuid        primary key default uuid_generate_v4(),
  client_id        uuid        not null references public.clients(id) on delete cascade,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text        not null default 'running',  -- running | success | partial | error
  campaigns_synced int         default 0,
  flows_synced     int         default 0,
  error            text,
  duration_ms      int,
  created_at       timestamptz not null default now()
);

create index idx_sr_client on public.sync_runs(client_id);
create index idx_sr_status on public.sync_runs(status);

-- ═════════════════════════════════════════════
-- 9. RLS — match existing pattern
-- ═════════════════════════════════════════════

alter table public.campaigns enable row level security;
alter table public.campaign_snapshots enable row level security;
alter table public.flows enable row level security;
alter table public.flow_snapshots enable row level security;
alter table public.sync_runs enable row level security;

-- campaigns: scoped to user's clients
create policy "read" on public.campaigns
  for select using (client_id in (select public.my_client_ids()));
create policy "insert" on public.campaigns
  for insert with check (client_id in (select public.my_client_ids()));
create policy "update" on public.campaigns
  for update using (client_id in (select public.my_client_ids()));
create policy "delete" on public.campaigns
  for delete using (client_id in (select public.my_client_ids()));

-- campaign_snapshots: through campaign's client_id
create policy "read" on public.campaign_snapshots
  for select using (
    campaign_id in (
      select id from public.campaigns
      where client_id in (select public.my_client_ids())
    )
  );
create policy "insert" on public.campaign_snapshots
  for insert with check (
    campaign_id in (
      select id from public.campaigns
      where client_id in (select public.my_client_ids())
    )
  );

-- flows: scoped to user's clients
create policy "read" on public.flows
  for select using (client_id in (select public.my_client_ids()));
create policy "insert" on public.flows
  for insert with check (client_id in (select public.my_client_ids()));
create policy "update" on public.flows
  for update using (client_id in (select public.my_client_ids()));
create policy "delete" on public.flows
  for delete using (client_id in (select public.my_client_ids()));

-- flow_snapshots: through flow's client_id
create policy "read" on public.flow_snapshots
  for select using (
    flow_id in (
      select id from public.flows
      where client_id in (select public.my_client_ids())
    )
  );
create policy "insert" on public.flow_snapshots
  for insert with check (
    flow_id in (
      select id from public.flows
      where client_id in (select public.my_client_ids())
    )
  );

-- sync_runs: scoped to user's clients
create policy "read" on public.sync_runs
  for select using (client_id in (select public.my_client_ids()));
create policy "insert" on public.sync_runs
  for insert with check (client_id in (select public.my_client_ids()));
create policy "update" on public.sync_runs
  for update using (client_id in (select public.my_client_ids()));
