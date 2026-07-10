-- ============================================================================
-- BizCompliance — Migration 0004: SAF cross-reference + re-audit lineage
-- Run after 0003.
-- ============================================================================

-- Autopilot suggestions on SAF interview responses. The engine infers a likely
-- 'no' when the document that underpins a question is missing; a human confirms.
alter table public.saf_responses
  add column if not exists suggested_answer public.saf_answer not null default 'unset',
  add column if not exists suggestion_reason text;

-- Re-audit lineage: link each re-audit back to the audit it follows, so score
-- trends read cleanly and the cron never double-creates.
alter table public.audits
  add column if not exists parent_audit_id uuid references public.audits (id) on delete set null,
  add column if not exists auto_created boolean not null default false;

create index if not exists audits_parent_idx on public.audits (parent_audit_id);
create index if not exists audits_delivered_idx on public.audits (org_id, delivered_at)
  where status in ('delivered', 'closed');
create index if not exists saf_responses_suggested_idx on public.saf_responses (audit_id)
  where suggested_answer <> 'unset';

-- Anonymous benchmark: returns aggregate stats for the whole cohort of
-- delivered audits without exposing any individual org's rows (security definer).
-- A client can see where their score sits without seeing anyone else's data.
create or replace function public.audit_benchmark(p_score integer)
returns table (cohort_size bigint, cohort_avg integer, pct_below integer)
language sql stable security definer set search_path = public as $$
  select
    count(*)::bigint as cohort_size,
    coalesce(round(avg(score))::int, 0) as cohort_avg,
    coalesce(round(100.0 * count(*) filter (where score < p_score) / nullif(count(*), 0))::int, 0) as pct_below
  from public.audits
  where status in ('delivered', 'closed') and score is not null;
$$;

grant execute on function public.audit_benchmark(integer) to authenticated;
