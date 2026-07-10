-- ============================================================================
-- Migration 0007: alerts review queue + source metadata
-- Keeps incoming CQC items staged in admin until manually approved.
-- ============================================================================

alter table public.alerts
  add column if not exists source_kind text not null default 'manual',
  add column if not exists approved_at timestamptz;

create index if not exists alerts_published_idx on public.alerts (published, created_at desc);
create index if not exists alerts_source_kind_idx on public.alerts (source_kind, created_at desc);
