# KDC CRM Operations System — Kenny Donna Collective

Internal multi-client CRM operations platform: client workspaces, audits, Klaviyo ingestion, campaign/flow reporting, monthly summaries, calendars, briefs, testing, and recommendations.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Supabase** (Auth, Postgres, RLS)
- **Tailwind** + **shadcn/ui** (planned)

## Database — 15 tables

| # | Table | Purpose |
|---|-------|---------|
| 1 | `clients` | Managed client tenants (name, industry, status) |
| 2 | `user_clients` | Many-to-many user-client mapping with roles |
| 3 | `client_goals` | Quarterly/monthly performance goals |
| 4 | `audits` | CRM audit records per client |
| 5 | `audit_findings` | Individual findings from audits |
| 6 | `campaign_raw_uploads` | Tracks Klaviyo campaign CSV uploads |
| 7 | `flow_raw_uploads` | Tracks Klaviyo flow CSV uploads |
| 8 | `campaign_performance` | Parsed campaign metrics (CTR, CVR, RPR, AOV auto-calculated) |
| 9 | `flow_performance_daily` | Daily flow metrics per message (CTR, CVR, RPR, AOV auto-calculated) |
| 10 | `monthly_shopify_summary` | Manual Shopify revenue entry per month |
| 11 | `monthly_crm_summary` | Aggregated CRM KPIs with generated columns |
| 12 | `calendars` | Monthly send calendars per client |
| 13 | `calendar_campaigns` | Individual scheduled sends on a calendar |
| 14 | `briefs` | Creative/campaign briefs |
| 15 | `tests` | A/B tests and experiments |
| 16 | `recommendations` | Strategic recommendations from audits/tests |

## Setup

1. **Install dependencies**

   ```bash
   cd kdc-crm && npm install
   ```

2. **Supabase**

   Create a project at [supabase.com](https://supabase.com) and run migrations in order:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_rls.sql`

3. **Environment**

   Copy `.env.local.example` → `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. **Auth & client setup**

   - Create users via Supabase Auth.
   - Insert `clients` rows, then `user_clients` rows linking users to clients with a role (`admin` | `strategist` | `analyst` | `viewer`).

5. **Run**

   ```bash
   npm run dev
   ```

## CSV upload endpoints

- **Campaigns:** `POST /api/upload/campaigns` — `multipart/form-data` with fields `file` (CSV) and `client_id`.
- **Flows:** `POST /api/upload/flows` — `multipart/form-data` with fields `file` (CSV) and `client_id`.

Both require an authenticated user with `admin`, `strategist`, or `analyst` role on the client. Each upload creates a `campaign_raw_uploads` / `flow_raw_uploads` record and inserts parsed rows into `campaign_performance` / `flow_performance_daily`.

## KPIs (all auto-calculated as GENERATED ALWAYS columns)

- **CTR** = clicks / delivered
- **CVR** = orders / clicks
- **RPR** = revenue / delivered
- **AOV** = revenue / orders
- **Total CRM Revenue** = campaign_revenue + flow_revenue
- **CRM % of Total Revenue** = total_crm_revenue / shopify_total_revenue

## RLS

Row-level security isolates all data by `client_id` through `user_clients`. Helper functions: `user_client_ids()`, `user_role_for_client(uuid)`, `can_write(uuid)`.
