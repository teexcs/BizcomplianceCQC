-- Regulatory alerts: legislative flag + calendar link
-- ---------------------------------------------------------------------------
-- Some alerts carry legal/legislative weight (new law, statutory guidance,
-- regulation changes). These are the ones a provider must ACT on by a date, so
-- the admin can push them to client calendars. This flag lets the feed mark
-- such items and the admin filter/push them.

alter table public.alerts
  add column if not exists legislative boolean not null default false;

create index if not exists alerts_legislative_idx
  on public.alerts (legislative, created_at desc);

-- Link a calendar event back to the alert it was pushed from, so re-pushing an
-- alert doesn't duplicate events and the admin can see what was already pushed.
alter table public.calendar_events
  add column if not exists alert_id uuid references public.alerts (id) on delete set null;

create index if not exists calendar_events_alert_idx
  on public.calendar_events (alert_id);

comment on column public.alerts.legislative is
  'True when the alert involves law/legislation/statutory guidance — eligible to push to client calendars as a dated action.';
