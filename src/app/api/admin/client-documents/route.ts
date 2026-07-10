import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/data/session';

export const runtime = 'nodejs';

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
}

export async function POST(request: Request) {
  const ctx = await requireAdminSession();
  const form = await request.formData();
  const auditId = (form.get('audit_id') as string | null) || null;
  const title = String(form.get('title') ?? '').trim();
  const note = String(form.get('note') ?? '').trim() || null;
  const file = form.get('file');

  if (!auditId || !/^[0-9a-f-]{36}$/i.test(auditId)) {
    return NextResponse.json({ error: 'Choose an audit first.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a file to send.' }, { status: 400 });
  }
  if (title.length < 2) {
    return NextResponse.json({ error: 'Give the document a title.' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be between 1 byte and 25MB.' }, { status: 400 });
  }

  const ext = ALLOWED_TYPES.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: 'Unsupported file type. Allowed: PDF, Word, Excel, CSV, text, PNG, JPG.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: audit } = await admin
    .from('audits')
    .select('id, org_id, status')
    .eq('id', auditId)
    .single<{ id: string; org_id: string; status: string }>();

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found.' }, { status: 404 });
  }
  if (!['delivered', 'closed'].includes(audit.status)) {
    return NextResponse.json(
      { error: 'You can only issue documents after the audit has been delivered.' },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = safeFileName(file.name);
  const storagePath = `${audit.org_id}/${audit.id}/${Date.now()}-${randomUUID()}-${originalName}`;

  const { error: uploadError } = await admin.storage.from('deliverables').upload(storagePath, bytes, {
    contentType: file.type,
  });
  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed — please try again.' }, { status: 500 });
  }

  const { data: priorDocs } = await admin
    .from('client_documents')
    .select('id')
    .eq('org_id', audit.org_id)
    .eq('audit_id', audit.id)
    .eq('title', title)
    .eq('status', 'issued');

  const priorIds = ((priorDocs as { id: string }[]) ?? []).map((row) => row.id);
  if (priorIds.length) {
    await admin
      .from('client_documents')
      .update({ status: 'superseded' })
      .in('id', priorIds);
  }

  const { count: sameTitleCount } = await admin
    .from('client_documents')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', audit.org_id)
    .eq('audit_id', audit.id)
    .eq('title', title)
    .neq('status', 'withdrawn');

  const version = `${(sameTitleCount ?? 0) + 1}.0`;

  const { data: doc, error: insertError } = await admin
    .from('client_documents')
    .insert({
      org_id: audit.org_id,
      audit_id: audit.id,
      asset_id: null,
      title,
      storage_path: storagePath,
      file_name: originalName,
      version,
      note,
      status: 'issued',
      issued_by: ctx.userId,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertError || !doc) {
    await admin.storage.from('deliverables').remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: 'Could not create the document record.' }, { status: 500 });
  }

  revalidatePath(`/admin/audits/${audit.id}`);
  revalidatePath('/dashboard/documents');

  return NextResponse.json({ ok: true, id: doc.id, superseded: priorIds.length });
}
