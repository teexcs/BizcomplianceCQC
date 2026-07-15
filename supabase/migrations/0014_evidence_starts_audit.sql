-- Evidence must be connected to an audit so the admin workbench and reader
-- engine are looking at the same client context.

do $$
declare
  r record;
  v_audit_id uuid;
begin
  for r in
    select distinct e.org_id
    from public.evidence_files e
    where e.lifecycle_state = 'current'
      and not exists (
        select 1
        from public.audits a
        where a.org_id = e.org_id
          and a.status in ('intake', 'evidence', 'in_review', 'report_draft')
      )
  loop
    insert into public.audits (
      org_id,
      kind,
      status,
      due_at,
      auto_created
    )
    values (
      r.org_id,
      'one_off',
      'evidence',
      now() + interval '48 hours',
      true
    )
    returning id into v_audit_id;

    perform public.build_audit_snapshot(v_audit_id);

    insert into public.tasks (
      title,
      org_id,
      audit_id,
      kind,
      priority,
      due_date
    )
    values (
      'Evidence uploaded - run CQC readiness audit',
      r.org_id,
      v_audit_id,
      'audit',
      'high',
      (now() + interval '48 hours')::date
    );
  end loop;
end $$;

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
  and e.audit_id is null
  and e.lifecycle_state = 'current';
