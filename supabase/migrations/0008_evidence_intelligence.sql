-- Evidence intelligence
-- ---------------------------------------------------------------------------
-- Teaches the engine to READ documents, not just match filenames. Every
-- uploaded file is extracted to text (docx/pdf/xlsx/csv, or OCR for scanned
-- PDFs and images) and then content-verified. Results live on the evidence
-- row so the matcher, scorer and workbench can use them.

alter table public.evidence_files
  add column if not exists extracted_text text,
  add column if not exists extract_method text,
  add column if not exists extract_status text not null default 'pending',
  add column if not exists word_count integer,
  add column if not exists extracted_at timestamptz,
  add column if not exists verification jsonb,
  add column if not exists verified_at timestamptz;

-- Sweeper index: the cron finds still-unprocessed documents cheaply.
-- Existing rows are backfilled to 'pending' by the column default above, so
-- the sweeper picks up everything already in the vault on its next run.
create index if not exists evidence_files_extract_pending_idx
  on public.evidence_files (created_at)
  where extract_status = 'pending';

comment on column public.evidence_files.extracted_text is
  'Machine-readable text pulled from the document (docx/pdf/xlsx/csv) or OCR (scanned pdf/image). Null until processed.';
comment on column public.evidence_files.extract_status is
  'pending | done | unsupported | failed — drives the extraction sweeper.';
comment on column public.evidence_files.verification is
  'Content checks: identity confidence, template/placeholder detection, provider-name match, parsed review date, out-of-date flag, missing required elements.';
