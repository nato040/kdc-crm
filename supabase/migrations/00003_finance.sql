-- KDC CRM OS — Finance tables
-- Business-level revenue & cost tracking from AMEX / bank statements + receipts.

-- ─────────────────────────────────────────────
-- finance_accounts
-- ─────────────────────────────────────────────
create table public.finance_accounts (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  account_type text not null default 'checking',  -- checking | savings | credit_card
  last_four    text,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- statement_uploads
-- ─────────────────────────────────────────────
create table public.statement_uploads (
  id            uuid primary key default uuid_generate_v4(),
  account_id    uuid not null references public.finance_accounts(id) on delete cascade,
  file_name     text not null,
  file_path     text,
  upload_month  date,
  row_count     int not null default 0,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_su_account on public.statement_uploads(account_id);

-- ─────────────────────────────────────────────
-- transactions
-- ─────────────────────────────────────────────
create table public.transactions (
  id                  uuid primary key default uuid_generate_v4(),
  account_id          uuid not null references public.finance_accounts(id) on delete cascade,
  statement_upload_id uuid references public.statement_uploads(id) on delete set null,
  tx_date             date not null,
  description         text,
  amount              numeric not null default 0,
  category            text,
  reference           text,
  notes               text,
  created_at          timestamptz not null default now()
);

create index idx_tx_account on public.transactions(account_id);
create index idx_tx_date    on public.transactions(tx_date);
create index idx_tx_upload  on public.transactions(statement_upload_id);

-- ─────────────────────────────────────────────
-- receipts
-- ─────────────────────────────────────────────
create table public.receipts (
  id              uuid primary key default uuid_generate_v4(),
  transaction_id  uuid references public.transactions(id) on delete set null,
  file_name       text not null,
  file_path       text not null,
  content_type    text,
  notes           text,
  uploaded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index idx_receipts_tx on public.receipts(transaction_id);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.finance_accounts enable row level security;
alter table public.statement_uploads enable row level security;
alter table public.transactions enable row level security;
alter table public.receipts enable row level security;

-- Any authenticated user can access business finance data
create policy "auth_select" on public.finance_accounts  for select using (auth.uid() is not null);
create policy "auth_insert" on public.finance_accounts  for insert with check (auth.uid() is not null);
create policy "auth_update" on public.finance_accounts  for update using (auth.uid() is not null);
create policy "auth_delete" on public.finance_accounts  for delete using (auth.uid() is not null);

create policy "auth_select" on public.statement_uploads for select using (auth.uid() is not null);
create policy "auth_insert" on public.statement_uploads for insert with check (auth.uid() is not null);
create policy "auth_update" on public.statement_uploads for update using (auth.uid() is not null);
create policy "auth_delete" on public.statement_uploads for delete using (auth.uid() is not null);

create policy "auth_select" on public.transactions      for select using (auth.uid() is not null);
create policy "auth_insert" on public.transactions      for insert with check (auth.uid() is not null);
create policy "auth_update" on public.transactions      for update using (auth.uid() is not null);
create policy "auth_delete" on public.transactions      for delete using (auth.uid() is not null);

create policy "auth_select" on public.receipts          for select using (auth.uid() is not null);
create policy "auth_insert" on public.receipts          for insert with check (auth.uid() is not null);
create policy "auth_update" on public.receipts          for update using (auth.uid() is not null);
create policy "auth_delete" on public.receipts          for delete using (auth.uid() is not null);

-- ─────────────────────────────────────────────
-- Supabase Storage buckets (run via dashboard or supabase CLI)
-- create statements bucket: supabase storage create statements --public false
-- create receipts   bucket: supabase storage create receipts   --public false
-- ─────────────────────────────────────────────
