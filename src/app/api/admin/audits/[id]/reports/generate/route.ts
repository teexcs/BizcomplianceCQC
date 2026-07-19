import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/data/session';
import { generateAuditReport } from '@/lib/report/admin-generation';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: 'Invalid audit.' }, { status: 400 });
  }

  try {
    await requireAdminSession();
    const result = await generateAuditReport(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error('[api] report generation failed', error);
    return NextResponse.json(
      { ok: false, error: 'Could not generate the report.' },
      { status: 500 },
    );
  }
}
