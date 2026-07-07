-- ============================================================================
-- BizCompliance — CQC Compliance Engine
-- Migration 0001: full schema, RLS, triggers, storage buckets & policies
-- Run this whole file once in the Supabase SQL editor (or `supabase db push`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('client', 'admin');
create type public.plan_id as enum ('audit', 'essentials', 'professional', 'partner');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');
create type public.purchase_status as enum ('paid', 'refunded');
create type public.audit_kind as enum ('one_off', 're_audit');
create type public.audit_status as enum ('intake', 'evidence', 'in_review', 'report_draft', 'delivered', 'closed');
create type public.item_status as enum ('unset', 'present', 'missing', 'out_of_date', 'na');
create type public.rag_status as enum ('unset', 'green', 'amber', 'red');
create type public.requirement_level as enum ('legal', 'cqc', 'best', 'optional');
create type public.saf_answer as enum ('unset', 'yes', 'partial', 'no', 'na');
create type public.saf_domain as enum ('safe', 'effective', 'caring', 'responsive', 'well_led');
create type public.scan_status as enum ('pending', 'clean', 'infected', 'error');
create type public.review_status as enum ('pending', 'reviewed', 'flagged');
create type public.request_status as enum ('open', 'in_review', 'delivered', 'closed');
create type public.priority_level as enum ('low', 'medium', 'high');
create type public.doc_status as enum ('issued', 'superseded', 'withdrawn');
create type public.finding_priority as enum ('fix_first', 'days_7', 'days_14', 'days_30');
create type public.finding_status as enum ('open', 'resolved');

-- ----------------------------------------------------------------------------
-- Core tables
-- ----------------------------------------------------------------------------
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_type text not null default 'domiciliary-care',
  cqc_provider_id text,
  cqc_location_id text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'client',
  org_id uuid references public.organisations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_idx on public.profiles (org_id);

-- ----------------------------------------------------------------------------
-- Helper functions (defined before policies that use them)
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Billing
-- ----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan public.plan_id not null,
  status public.subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_org_idx on public.subscriptions (org_id);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  product public.plan_id not null default 'audit',
  amount_pence integer not null default 0,
  status public.purchase_status not null default 'paid',
  created_at timestamptz not null default now()
);

create index purchases_org_idx on public.purchases (org_id);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Library (founder's 139-asset library — admin only)
-- ----------------------------------------------------------------------------
create table public.library_areas (
  code text primary key,             -- '01' .. '18'
  name text not null,
  regulation_title text,
  regulation_summary text,
  sort integer not null default 0
);

create table public.library_assets (
  id uuid primary key default gen_random_uuid(),
  area_code text not null references public.library_areas (code),
  ref text not null unique,          -- e.g. 'RG-01'
  title text not null,
  doc_type text not null,
  requirement public.requirement_level not null,
  commercial_value text,
  regulatory_basis text,
  storage_path text,                 -- path in the 'library' bucket
  current_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index library_assets_area_idx on public.library_assets (area_code);

-- Documents issued to a client (founder-issued model)
create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  asset_id uuid references public.library_assets (id) on delete set null,
  title text not null,
  storage_path text not null,        -- path in the 'deliverables' bucket
  version text not null default '1.0',
  note text,
  status public.doc_status not null default 'issued',
  issued_by uuid references auth.users (id),
  issued_at timestamptz not null default now()
);

create index client_documents_org_idx on public.client_documents (org_id);

-- ----------------------------------------------------------------------------
-- Evidence vault
-- ----------------------------------------------------------------------------
create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  audit_id uuid,
  area_code text references public.library_areas (code),
  storage_path text not null,        -- path in the 'evidence' bucket
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references auth.users (id),
  scan_status public.scan_status not null default 'pending',
  review_status public.review_status not null default 'pending',
  reviewer_note text,
  created_at timestamptz not null default now()
);

create index evidence_org_idx on public.evidence_files (org_id);
create index evidence_audit_idx on public.evidence_files (audit_id);

-- ----------------------------------------------------------------------------
-- Audit engine
-- ----------------------------------------------------------------------------
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  kind public.audit_kind not null default 'one_off',
  status public.audit_status not null default 'intake',
  intake jsonb not null default '{}'::jsonb,
  score integer,
  summary text,
  purchase_id uuid references public.purchases (id),
  started_at timestamptz not null default now(),
  due_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audits_org_idx on public.audits (org_id);
create index audits_status_idx on public.audits (status);

alter table public.evidence_files
  add constraint evidence_audit_fk foreign key (audit_id) references public.audits (id) on delete set null;

-- Snapshot of the 139-item checklist for one audit
create table public.audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  area_code text not null references public.library_areas (code),
  ref text not null,
  title text not null,
  requirement public.requirement_level not null,
  status public.item_status not null default 'unset',
  note text,
  evidence_id uuid references public.evidence_files (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (audit_id, ref)
);

create index audit_items_audit_idx on public.audit_items (audit_id);

-- Per-area RAG + narrative for one audit
create table public.audit_areas (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  area_code text not null references public.library_areas (code),
  rag public.rag_status not null default 'unset',
  evidence_sighted text,
  findings text,
  action text,
  owner text,
  updated_at timestamptz not null default now(),
  unique (audit_id, area_code)
);

create index audit_areas_audit_idx on public.audit_areas (audit_id);

-- SAF interview framework (static, seeded)
create table public.saf_questions (
  id integer primary key,            -- question_no 1..68
  domain public.saf_domain not null,
  statement_no integer not null,     -- quality statement 1..34
  statement text not null,
  question text not null,
  evidence_hint text,
  priority boolean not null default false
);

create table public.saf_responses (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  question_id integer not null references public.saf_questions (id),
  answer public.saf_answer not null default 'unset',
  note text,
  updated_at timestamptz not null default now(),
  unique (audit_id, question_id)
);

create index saf_responses_audit_idx on public.saf_responses (audit_id);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  area_code text references public.library_areas (code),
  severity public.rag_status not null default 'amber',
  title text not null,
  detail text,
  recommendation text,
  priority public.finding_priority not null default 'days_14',
  status public.finding_status not null default 'open',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index findings_audit_idx on public.audit_findings (audit_id);
create index findings_org_idx on public.audit_findings (org_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  storage_path text not null,        -- path in the 'reports' bucket
  score integer not null,
  version integer not null default 1,
  published boolean not null default false,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_org_idx on public.reports (org_id);
create index reports_audit_idx on public.reports (audit_id);

-- ----------------------------------------------------------------------------
-- Client workspace: requests, alerts, calendar
-- ----------------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid references auth.users (id),
  type text not null,
  priority public.priority_level not null default 'medium',
  description text not null,
  status public.request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_org_idx on public.requests (org_id);

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  author_id uuid references auth.users (id),
  body text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index request_messages_request_idx on public.request_messages (request_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'well-led',
  external_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.alert_reads (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations (id) on delete cascade, -- null = global
  title text not null,
  description text,
  event_type text not null default 'review',
  due_date date not null,
  source text not null default 'manual',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index calendar_org_idx on public.calendar_events (org_id);
create index calendar_due_idx on public.calendar_events (due_date);

-- ----------------------------------------------------------------------------
-- Founder ops: tasks, contact, activity
-- ----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  org_id uuid references public.organisations (id) on delete set null,
  audit_id uuid references public.audits (id) on delete set null,
  kind text not null default 'admin',
  priority public.priority_level not null default 'medium',
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations (id) on delete set null,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_org_idx on public.activity_log (org_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organisations','profiles','subscriptions','audits','audit_items',
    'audit_areas','saf_responses','audit_findings','requests','tasks'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- New-user bootstrap: create organisation + profile on signup.
-- The founder e-mail is auto-promoted to admin (second gate lives in app env).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_role public.user_role := 'client';
  v_business text;
begin
  if lower(new.email) = 'bizcompliance@outlook.com' then
    v_role := 'admin';
  end if;

  v_business := coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), split_part(new.email, '@', 1));

  if v_role = 'client' then
    insert into public.organisations (name, service_type, owner_id)
    values (
      v_business,
      coalesce(nullif(new.raw_user_meta_data ->> 'service_type', ''), 'domiciliary-care'),
      new.id
    )
    returning id into v_org_id;
  end if;

  insert into public.profiles (id, email, full_name, role, org_id)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_role,
    v_org_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Audit snapshot builder: copies the current library checklist into an audit.
-- Called by the app (service role) when an audit is created.
-- ----------------------------------------------------------------------------
create or replace function public.build_audit_snapshot(p_audit_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_items (audit_id, area_code, ref, title, requirement)
  select p_audit_id, a.area_code, a.ref, a.title, a.requirement
  from public.library_assets a
  order by a.ref
  on conflict (audit_id, ref) do nothing;

  insert into public.audit_areas (audit_id, area_code)
  select p_audit_id, la.code
  from public.library_areas la
  order by la.sort
  on conflict (audit_id, area_code) do nothing;

  insert into public.saf_responses (audit_id, question_id)
  select p_audit_id, q.id from public.saf_questions q
  on conflict (audit_id, question_id) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.stripe_events enable row level security;
alter table public.library_areas enable row level security;
alter table public.library_assets enable row level security;
alter table public.client_documents enable row level security;
alter table public.evidence_files enable row level security;
alter table public.audits enable row level security;
alter table public.audit_items enable row level security;
alter table public.audit_areas enable row level security;
alter table public.saf_questions enable row level security;
alter table public.saf_responses enable row level security;
alter table public.audit_findings enable row level security;
alter table public.reports enable row level security;
alter table public.requests enable row level security;
alter table public.request_messages enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_reads enable row level security;
alter table public.calendar_events enable row level security;
alter table public.tasks enable row level security;
alter table public.contact_messages enable row level security;
alter table public.activity_log enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own (not role/org)" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = 'client' and org_id = public.current_org_id());
create policy "profiles: admin update" on public.profiles
  for update using (public.is_admin()) with check (true);

-- organisations
create policy "orgs: members read" on public.organisations
  for select using (id = public.current_org_id() or public.is_admin());
create policy "orgs: owner update" on public.organisations
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- subscriptions / purchases (writes: service role only — no insert/update policies)
create policy "subs: org read" on public.subscriptions
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "purchases: org read" on public.purchases
  for select using (org_id = public.current_org_id() or public.is_admin());

-- library: areas readable by all signed-in users (labels only), assets admin-only
create policy "areas: authenticated read" on public.library_areas
  for select using (auth.uid() is not null);
create policy "areas: admin write" on public.library_areas
  for all using (public.is_admin()) with check (public.is_admin());
create policy "assets: admin only" on public.library_assets
  for all using (public.is_admin()) with check (public.is_admin());

-- client documents: org read; admin manage
create policy "client_docs: org read" on public.client_documents
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "client_docs: admin write" on public.client_documents
  for all using (public.is_admin()) with check (public.is_admin());

-- evidence
create policy "evidence: org read" on public.evidence_files
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "evidence: org insert" on public.evidence_files
  for insert with check (org_id = public.current_org_id());
create policy "evidence: admin update" on public.evidence_files
  for update using (public.is_admin()) with check (public.is_admin());
create policy "evidence: admin delete" on public.evidence_files
  for delete using (public.is_admin());

-- audits + children: org read, admin write
create policy "audits: org read" on public.audits
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "audits: admin write" on public.audits
  for all using (public.is_admin()) with check (public.is_admin());

create policy "audit_items: org read" on public.audit_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.audits a where a.id = audit_id and a.org_id = public.current_org_id()
    )
  );
create policy "audit_items: admin write" on public.audit_items
  for all using (public.is_admin()) with check (public.is_admin());

create policy "audit_areas: org read" on public.audit_areas
  for select using (
    public.is_admin() or exists (
      select 1 from public.audits a where a.id = audit_id and a.org_id = public.current_org_id()
    )
  );
create policy "audit_areas: admin write" on public.audit_areas
  for all using (public.is_admin()) with check (public.is_admin());

create policy "saf_questions: authenticated read" on public.saf_questions
  for select using (auth.uid() is not null);

create policy "saf_responses: org read" on public.saf_responses
  for select using (
    public.is_admin() or exists (
      select 1 from public.audits a where a.id = audit_id and a.org_id = public.current_org_id()
    )
  );
create policy "saf_responses: admin write" on public.saf_responses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "findings: org read" on public.audit_findings
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "findings: admin write" on public.audit_findings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "reports: org read published" on public.reports
  for select using ((org_id = public.current_org_id() and published) or public.is_admin());
create policy "reports: admin write" on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

-- requests
create policy "requests: org read" on public.requests
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "requests: org insert" on public.requests
  for insert with check (org_id = public.current_org_id() and created_by = auth.uid());
create policy "requests: admin update" on public.requests
  for update using (public.is_admin()) with check (public.is_admin());

create policy "req_messages: org read" on public.request_messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.requests r where r.id = request_id and r.org_id = public.current_org_id()
    )
  );
create policy "req_messages: participant insert" on public.request_messages
  for insert with check (
    author_id = auth.uid() and (
      public.is_admin() or exists (
        select 1 from public.requests r where r.id = request_id and r.org_id = public.current_org_id()
      )
    )
  );

-- alerts
create policy "alerts: read published" on public.alerts
  for select using ((published and auth.uid() is not null) or public.is_admin());
create policy "alerts: admin write" on public.alerts
  for all using (public.is_admin()) with check (public.is_admin());
create policy "alert_reads: own" on public.alert_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- calendar
create policy "calendar: org + global read" on public.calendar_events
  for select using (org_id is null and auth.uid() is not null or org_id = public.current_org_id() or public.is_admin());
create policy "calendar: admin write" on public.calendar_events
  for all using (public.is_admin()) with check (public.is_admin());

-- founder-only tables
create policy "tasks: admin only" on public.tasks
  for all using (public.is_admin()) with check (public.is_admin());
create policy "contact: admin read" on public.contact_messages
  for select using (public.is_admin());
create policy "contact: admin update" on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());
create policy "activity: admin read" on public.activity_log
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Storage buckets (all private; access via short-lived signed URLs from server)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('library', 'library', false, 52428800, null),
  ('evidence', 'evidence', false, 26214400, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'image/png', 'image/jpeg', 'image/webp'
  ]),
  ('deliverables', 'deliverables', false, 52428800, null),
  ('reports', 'reports', false, 52428800, null)
on conflict (id) do nothing;

-- Storage object policies: admin full control; everything else goes through the
-- app server (service role) which enforces org membership before signing URLs.
create policy "storage: admin all" on storage.objects
  for all using (
    bucket_id in ('library', 'evidence', 'deliverables', 'reports') and public.is_admin()
  )
  with check (
    bucket_id in ('library', 'evidence', 'deliverables', 'reports') and public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- Grants (Supabase default roles)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.alerts to anon; -- landing page can show published headlines
