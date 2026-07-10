-- ============================================================================
-- BizCompliance — Migration 0003: compliance engine
-- Autopilot suggestions, document review cycles, engine telemetry,
-- hot-path indexes and the single-query org_health view.
-- Run after 0001 and 0002 in the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Autopilot suggestions on checklist items.
-- The engine writes suggestions; only a human turns them into real statuses.
-- ----------------------------------------------------------------------------
alter table public.audit_items
  add column if not exists suggested_status public.item_status not null default 'unset',
  add column if not exists suggested_evidence_id uuid references public.evidence_files (id) on delete set null,
  add column if not exists suggestion_confidence numeric(4, 3),
  add column if not exists suggestion_reason text;

-- ----------------------------------------------------------------------------
-- Document review cycles: every issued document carries a 12-month review date.
-- ----------------------------------------------------------------------------
alter table public.client_documents
  add column if not exists review_due_at date;

update public.client_documents
set review_due_at = (issued_at + interval '12 months')::date
where review_due_at is null;

create or replace function public.set_review_due()
returns trigger language plpgsql as $$
begin
  if new.review_due_at is null then
    new.review_due_at := (coalesce(new.issued_at, now()) + interval '12 months')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists set_review_due on public.client_documents;
create trigger set_review_due
  before insert on public.client_documents
  for each row execute function public.set_review_due();

-- ----------------------------------------------------------------------------
-- Engine telemetry: every autopilot/cron run is recorded for observability.
-- ----------------------------------------------------------------------------
create table if not exists public.engine_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- 'autopilot.suggest' | 'autopilot.apply' | 'cron.daily' | 'match.upload'
  org_id uuid references public.organisations (id) on delete set null,
  audit_id uuid references public.audits (id) on delete set null,
  stats jsonb not null default '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists engine_runs_kind_idx on public.engine_runs (kind, created_at desc);

alter table public.engine_runs enable row level security;
create policy "engine_runs: admin read" on public.engine_runs
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Hot-path indexes
-- ----------------------------------------------------------------------------
create index if not exists evidence_org_created_idx on public.evidence_files (org_id, created_at desc);
create index if not exists evidence_review_pending_idx on public.evidence_files (review_status) where review_status = 'pending';
create index if not exists audit_items_audit_area_idx on public.audit_items (audit_id, area_code);
create index if not exists audit_items_suggested_idx on public.audit_items (audit_id) where suggested_status <> 'unset';
create index if not exists client_documents_review_idx on public.client_documents (review_due_at) where status = 'issued';
create index if not exists audits_active_idx on public.audits (org_id, created_at desc) where status not in ('delivered', 'closed');
create index if not exists calendar_system_idx on public.calendar_events (org_id, due_date) where source = 'system';
create index if not exists tasks_open_idx on public.tasks (due_date) where completed = false;

-- ----------------------------------------------------------------------------
-- org_health: the admin command centre in one query.
-- security_invoker means RLS on the underlying tables still applies.
-- ----------------------------------------------------------------------------
create or replace view public.org_health
with (security_invoker = true) as
select
  o.id as org_id,
  o.name,
  o.service_type,
  o.created_at as org_created_at,
  la.id as latest_audit_id,
  la.score as latest_score,
  la.status as latest_audit_status,
  la.due_at as latest_audit_due_at,
  coalesce(ev.pending, 0)::int as evidence_pending,
  coalesce(ev.total, 0)::int as evidence_total,
  coalesce(rq.open_count, 0)::int as open_requests,
  coalesce(cd.due_soon, 0)::int as reviews_due_soon,
  coalesce(cd.issued, 0)::int as documents_issued
from public.organisations o
left join lateral (
  select id, score, status, due_at
  from public.audits a
  where a.org_id = o.id
  order by a.created_at desc
  limit 1
) la on true
left join lateral (
  select
    count(*) filter (where e.review_status = 'pending') as pending,
    count(*) as total
  from public.evidence_files e
  where e.org_id = o.id
) ev on true
left join lateral (
  select count(*) as open_count
  from public.requests r
  where r.org_id = o.id and r.status in ('open', 'in_review')
) rq on true
left join lateral (
  select
    count(*) filter (where c.review_due_at <= (current_date + 45)) as due_soon,
    count(*) as issued
  from public.client_documents c
  where c.org_id = o.id and c.status = 'issued'
) cd on true;
