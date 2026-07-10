import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runWebsiteScan } from '@/lib/scanner/run';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(4).max(300),
  companyName: z.string().max(120).optional().or(z.literal('')),
  // Honeypot
  website: z.string().max(0).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid website address.' }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }); // bot

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`scan:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Scan limit reached — try again in an hour.' },
      { status: 429 },
    );
  }

  try {
    const scan = await runWebsiteScan({
      url: parsed.data.url,
      companyName: parsed.data.companyName || null,
      clientIp: ip,
    });
    return NextResponse.json({ ok: true, id: scan.id });
  } catch (e) {
    const message =
      e instanceof Error && e.message.length < 200
        ? e.message
        : 'The scan failed — please try again.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
