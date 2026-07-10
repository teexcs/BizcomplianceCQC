-- ============================================================================
-- BizCompliance — Migration 0005: public website compliance scanner
-- Anonymous scans, lead capture, and £8.99 full-report unlocks.
-- Run after 0004.
-- ============================================================================

create type public.website_scan_status as enum ('complete', 'failed');

create table public.website_scans (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  domain text not null,
  company_name text,
  email text,                          -- captured lead (nullable until given)
  status public.website_scan_status not null default 'complete',
  score numeric(4, 1),                 -- 0.0–10.0, one decimal
  urgent_count integer not null default 0,
  important_count integer not null default 0,
  passed_count integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  pages_scanned integer not null default 0,
  paid boolean not null default false,
  stripe_checkout_session_id text unique,
  report_storage_path text,
  client_ip text,
  created_at timestamptz not null default now()
);

create index website_scans_domain_idx on public.website_scans (domain, created_at desc);
create index website_scans_email_idx on public.website_scans (email) where email is not null;

-- Anonymous product: rows are only ever touched through server routes using
-- the service role; the scan id itself is the capability token. RLS on with
-- no policies = deny-all for anon/authenticated.
alter table public.website_scans enable row level security;
create policy "website_scans: admin read" on public.website_scans
  for select using (public.is_admin());
