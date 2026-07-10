import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { extractText, kindFromContentType } from './extract';
import { verifyDocument } from './verify';
import { inferEvidenceAreaCode } from './classify';

/**
 * Runs a single evidence file through the reading engine: download → extract
 * text (with OCR where needed) → verify content → persist → refresh the
 * checklist match now that we know what the document actually says.
 *
 * Best-effort and self-contained: any failure is recorded on the row and never
 * throws to the caller (upload route / cron sweeper).
 */
export async function processEvidenceExtraction(evidenceId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: file } = await admin
    .from('evidence_files')
    .select('id, org_id, storage_path, content_type, file_name, area_code')
    .eq('id', evidenceId)
    .single<{
      id: string;
      org_id: string;
      storage_path: string;
      content_type: string | null;
      file_name: string;
      area_code: string | null;
    }>();
  if (!file) return;

  const { data: blob, error: dlError } = await admin.storage
    .from('evidence')
    .download(file.storage_path);
  if (dlError || !blob) {
    await admin
      .from('evidence_files')
      .update({ extract_status: 'failed', extracted_at: new Date().toISOString() })
      .eq('id', evidenceId);
    return;
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const kind = kindFromContentType(file.content_type ?? '');
  const extraction = await extractText(bytes, kind);

  const { data: org } = await admin
    .from('organisations')
    .select('name')
    .eq('id', file.org_id)
    .single<{ name: string }>();

  // Now that we can read the document, sharpen the area classification.
  const areaCode = file.area_code ?? inferEvidenceAreaCode(file.file_name, extraction.text);

  const verification = verifyDocument({
    text: extraction.text,
    orgName: org?.name ?? null,
    expectedAreaCode: areaCode,
    fileName: file.file_name,
  });

  const extractStatus =
    extraction.method === 'none' ? 'unsupported' : extraction.ok ? 'done' : 'done';

  await admin
    .from('evidence_files')
    .update({
      extracted_text: extraction.text,
      extract_method: extraction.method,
      extract_status: extractStatus,
      word_count: extraction.words,
      extracted_at: new Date().toISOString(),
      verification: verification as unknown as Record<string, unknown>,
      verified_at: new Date().toISOString(),
      area_code: areaCode,
    })
    .eq('id', evidenceId);

  // Suggestions are produced by the deterministic reader when the admin runs
  // the engine in the workbench (see src/lib/engine/reader/adapter.ts). We no
  // longer write a fuzzy on-upload guess here — one brain, one pass.

  // Recompute the live score: a fresh, in-date document renews a gap and lifts
  // the number immediately (no-op unless the org has a delivered audit).
  try {
    const { snapshotLiveScore } = await import('@/lib/audit/live-score');
    await snapshotLiveScore(admin, file.org_id, 'evidence');
  } catch (e) {
    console.error('[evidence] live-score recompute failed', e);
  }
}

/**
 * Cron safety net: processes any documents still awaiting extraction. The
 * upload route fires extraction immediately, but this guarantees eventual
 * processing (and backfills everything already in the vault after migration).
 */
export async function sweepPendingExtractions(limit = 25): Promise<number> {
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from('evidence_files')
    .select('id')
    .eq('extract_status', 'pending')
    .eq('lifecycle_state', 'current')
    .neq('scan_status', 'infected')
    .order('created_at', { ascending: true })
    .limit(limit);

  const rows = (pending as { id: string }[]) ?? [];
  for (const row of rows) {
    await processEvidenceExtraction(row.id).catch((e) =>
      console.error('[evidence] sweep extraction failed', row.id, e),
    );
  }
  return rows.length;
}
