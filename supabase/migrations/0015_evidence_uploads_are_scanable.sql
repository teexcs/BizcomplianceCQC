-- Client-uploaded evidence is audit evidence, not a document-version history.
-- Keep every submitted file scannable by the engine.

update public.evidence_files
set
  lifecycle_state = 'current',
  scan_status = case
    when scan_status in ('infected', 'error') then 'pending'::public.scan_status
    else scan_status
  end,
  replaces_evidence_id = null,
  superseded_by_id = null
where lifecycle_state <> 'current'
   or scan_status in ('infected', 'error')
   or replaces_evidence_id is not null
   or superseded_by_id is not null;

with latest_active as (
  select distinct on (org_id)
    id,
    org_id
  from public.audits
  where status in ('intake', 'evidence', 'in_review', 'report_draft')
  order by org_id, created_at desc
)
update public.evidence_files e
set audit_id = latest_active.id
from latest_active
where e.org_id = latest_active.org_id
  and e.audit_id is null;
