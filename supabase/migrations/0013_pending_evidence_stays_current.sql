-- Pending evidence is the admin review queue. It must not be hidden in history
-- before an auditor has checked it.
update public.evidence_files
set
  lifecycle_state = 'current',
  superseded_by_id = null
where review_status = 'pending'
  and lifecycle_state = 'superseded';

update public.evidence_files
set replaces_evidence_id = null
where review_status = 'pending'
  and replaces_evidence_id = id;

update public.evidence_files
set replaces_evidence_id = null
where replaces_evidence_id in (
  select id
  from public.evidence_files
  where review_status = 'pending'
);
