import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/data/session';

export const runtime = 'nodejs';

const SIGNED_URL_TTL_SECONDS = 120;

/**
 * Authorised download endpoint. Access control happens through the RLS-scoped
 * read of the metadata row: if the signed-in user can see the row, they may
 * download its file. The signed URL itself is minted with the service role.
 *
 * GET /api/files/download?type=evidence|document|report|library&id=<row-id>
 */
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  if (!type || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const supabase = await createClient(); // RLS-scoped
  let bucket: string | null = null;
  let path: string | null = null;
  let downloadName: string | undefined;

  if (type === 'evidence') {
    const { data } = await supabase
      .from('evidence_files')
      .select('storage_path, file_name, scan_status')
      .eq('id', id)
      .maybeSingle<{ storage_path: string; file_name: string; scan_status: string }>();
    if (data && data.scan_status !== 'infected') {
      bucket = 'evidence';
      path = data.storage_path;
      downloadName = data.file_name;
    }
  } else if (type === 'document') {
    const { data } = await supabase
      .from('client_documents')
      .select('storage_path, title, version')
      .eq('id', id)
      .maybeSingle<{ storage_path: string; title: string; version: string }>();
    if (data) {
      bucket = 'deliverables';
      path = data.storage_path;
      downloadName = `${data.title} v${data.version}.docx`;
    }
  } else if (type === 'report') {
    const { data } = await supabase
      .from('reports')
      .select('storage_path, version')
      .eq('id', id)
      .maybeSingle<{ storage_path: string; version: number }>();
    if (data) {
      bucket = 'reports';
      path = data.storage_path;
      downloadName = `CQC Readiness Report v${data.version}.pdf`;
    }
  } else if (type === 'library') {
    // Founder-only: RLS returns no row for clients.
    const { data } = await supabase
      .from('library_assets')
      .select('storage_path, ref, title')
      .eq('id', id)
      .maybeSingle<{ storage_path: string | null; ref: string; title: string }>();
    if (data?.storage_path) {
      bucket = 'library';
      path = data.storage_path;
      downloadName = `${data.ref} ${data.title}.docx`;
    }
  } else {
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }

  if (!bucket || !path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: downloadName });
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not prepare the download' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 307 });
}
