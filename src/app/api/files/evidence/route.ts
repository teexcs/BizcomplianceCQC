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
  const ctx = await getSessionContext();
  if (!ctx || !ctx.org) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!rateLimit(`upload:${ctx.userId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Upload limit reached — try again later.' }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const areaCode = (form.get('area_code') as string | null) || null;
  const auditId = (form.get('audit_id') as string | null) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file supplied' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be between 1 byte and 25MB.' }, { status: 400 });
  }
  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
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
  const storagePath = `${ctx.org.id}/${randomUUID()}-${safeName}`;

  const admin = createAdminClient();
  const { error: upError } = await admin.storage
    .from('evidence')
    .upload(storagePath, bytes, { contentType: file.type });
  if (upError) {
    return NextResponse.json({ error: 'Upload failed — please try again.' }, { status: 500 });
  }

  const { data: row, error: dbError } = await admin
    .from('evidence_files')
    .insert({
      org_id: ctx.org.id,
      audit_id: auditId,
      area_code: areaCode,
      storage_path: storagePath,
      file_name: safeName,
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: ctx.userId,
      scan_status: scanStatus,
    })
    .select('id')
    .single<{ id: string }>();
  if (dbError) {
    await admin.storage.from('evidence').remove([storagePath]);
    return NextResponse.json({ error: 'Upload failed — please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: row.id });
}
