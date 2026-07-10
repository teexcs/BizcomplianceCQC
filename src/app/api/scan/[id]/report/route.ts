import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getScan } from '@/lib/scanner/run';
import { generateScanReport } from '@/lib/report/scan-report';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Signed download of the paid PDF report. The scan id is the capability. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getScan(id);
  if (!scan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!scan.paid) return NextResponse.json({ error: 'Report not purchased' }, { status: 402 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('website_scans')
    .select('report_storage_path')
    .eq('id', id)
    .single<{ report_storage_path: string | null }>();

  let path = row?.report_storage_path ?? null;
  if (!path) path = await generateScanReport(id); // regenerate if the webhook attempt failed
  if (!path) return NextResponse.json({ error: 'Report unavailable — contact us.' }, { status: 500 });

  const { data: signed, error } = await admin.storage
    .from('reports')
    .createSignedUrl(path, 120, { download: `Website Compliance Report - ${scan.domain}.pdf` });
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not prepare the download' }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl, { status: 307 });
}
