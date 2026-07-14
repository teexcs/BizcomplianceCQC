import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getSessionContext } from '@/lib/data/session';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['text/csv', 'csv'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

const EXT_TO_MIME = new Map<string, string>([
  ['pdf', 'application/pdf'],
  ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['csv', 'text/csv'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
]);

function fileExt(name: string): string {
  const match = /\.([^.]+)$/.exec(name.trim());
  return (match?.[1] ?? '').toLowerCase();
}

/**
 * Optional malware scan hook. Configure MALWARE_SCAN_COMMAND (e.g. `clamscan`)
 * and MALWARE_SCAN_ARGS in env. Exit code 0 = clean, 1 = infected.
 * Returns 'clean' | 'infected' | 'pending' (scanner unavailable).
 */
async function scanFile(bytes: Buffer): Promise<'clean' | 'infected' | 'pending'> {
  const command = process.env.MALWARE_SCAN_COMMAND;
  if (!command) return 'pending';
  const args = (process.env.MALWARE_SCAN_ARGS ?? '').split(' ').filter(Boolean);
  const tmpPath = join(tmpdir(), `bc-scan-${randomUUID()}`);
  try {
    await writeFile(tmpPath, bytes);
    await execFileAsync(command, [...args, tmpPath], { timeout: 30_000 });
    return 'clean';
  } catch (e) {
    const err = e as { code?: number };
    if (err.code === 1) return 'infected';
    return 'pending'; // scanner missing or errored — reviewed manually
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function POST(request: Request) {
  try {
    return await handleUpload(request);
  } catch (e) {
    // Catch ANY unhandled throw so the real cause is logged instead of a bare
    // 500. (scanFile, formData parsing, session, dynamic imports, etc.)
    console.error('[upload] unhandled error', e);
    return NextResponse.json({ error: 'Upload failed — please try again.' }, { status: 500 });
  }
}

async function handleUpload(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.org) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!rateLimit(`upload:${ctx.userId}`, 500, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Upload limit reached — try again later.' }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const manualAreaCode = (form.get('area_code') as string | null) || null;
  const auditId = (form.get('audit_id') as string | null) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file supplied' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be between 1 byte and 25MB.' }, { status: 400 });
  }
  // Resolve a REAL MIME type for the storage upload. Trust the browser's
  // file.type when it's one we allow; otherwise fall back to the extension.
  // (Bug fix: previously this returned the short extension — e.g. "docx" — and
  // passed it as the Content-Type header, which Supabase Storage rejects with
  // "Invalid Content-Type header".)
  const nameExt = fileExt(file.name);
  const contentType = ALLOWED_TYPES.has(file.type) ? file.type : EXT_TO_MIME.get(nameExt);
  if (!contentType) {
    return NextResponse.json(
      { error: 'Unsupported file type. Allowed: PDF, Word, Excel, CSV, PNG, JPG.' },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const scanStatus = await scanFile(bytes);
  if (scanStatus === 'infected') {
    return NextResponse.json({ error: 'This file failed the malware scan.' }, { status: 422 });
  }

  const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  // "Let the system decide" (no manual area) → leave area_code NULL so the async
  // extractor classifies authoritatively from the document's real content (the
  // reader engine). A filename-only guess here would otherwise stick even when
  // the content says a different area, so we defer to content instead.
  // When the client explicitly picks a category, we honour it as-is.
  const inferredAreaCode = manualAreaCode;
  const storagePath = `${ctx.org.id}/${randomUUID()}-${safeName}`;

  const admin = createAdminClient();
  const { error: upError } = await admin.storage
    .from('evidence')
    .upload(storagePath, bytes, { contentType });
  if (upError) {
    console.error('[upload] storage upload failed', {
      file: safeName,
      message: upError.message,
    });
    return NextResponse.json({ error: 'Upload failed — please try again.' }, { status: 500 });
  }

  const { data: row, error: dbError } = await admin
    .from('evidence_files')
    .insert({
      org_id: ctx.org.id,
      audit_id: auditId,
      area_code: inferredAreaCode,
      storage_path: storagePath,
      file_name: safeName,
      content_type: contentType,
      size_bytes: file.size,
      uploaded_by: ctx.userId,
      scan_status: scanStatus,
      lifecycle_state: 'current',
    })
    .select('id')
    .single<{ id: string }>();
  if (dbError) {
    console.error('[upload] evidence_files insert failed', {
      file: safeName,
      code: dbError.code,
      message: dbError.message,
      details: dbError.details,
      hint: dbError.hint,
    });
    await admin.storage.from('evidence').remove([storagePath]);
    return NextResponse.json({ error: 'Upload failed — please try again.' }, { status: 500 });
  }

  const previousQuery = admin
    .from('evidence_files')
    .select('id')
    .eq('org_id', ctx.org.id)
    .eq('lifecycle_state', 'current')
    .eq('file_name', safeName)
    .order('created_at', { ascending: false })
    .limit(1);
  const previous = inferredAreaCode
    ? await previousQuery.eq('area_code', inferredAreaCode).maybeSingle<{ id: string }>()
    : await previousQuery.is('area_code', null).maybeSingle<{ id: string }>();

  if (previous.data?.id) {
    await admin
      .from('evidence_files')
      .update({ lifecycle_state: 'superseded', superseded_by_id: row.id })
      .eq('id', previous.data.id);
    await admin
      .from('evidence_files')
      .update({ replaces_evidence_id: previous.data.id })
      .eq('id', row.id);
  }

  // Read the document (extract text + OCR, then content-verify) and refresh the
  // engine match. Fired async so uploads stay fast even when a scanned PDF needs
  // OCR; the row is 'pending' until done and the daily cron sweep is the safety
  // net. Failure here never fails the upload.
  void (async () => {
    try {
      const { processEvidenceExtraction } = await import('@/lib/evidence/process');
      await processEvidenceExtraction(row.id);
    } catch (e) {
      console.error('[engine] evidence extraction failed', e);
    }
  })();

  return NextResponse.json({ ok: true, id: row.id, replaced: previous.data?.id ?? null });
}
