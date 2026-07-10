import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe/client';
import { getScan } from '@/lib/scanner/run';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const bodySchema = z.object({ scanId: z.string().uuid() });

/** Guest checkout for the £8.99 detailed website report. */
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_WEBSITE_REPORT) {
    return NextResponse.json(
      { error: 'Payments for the full report are not live yet — check back soon.' },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`scan-checkout:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts — try again later.' }, { status: 429 });
  }

  const scan = await getScan(parsed.data.scanId);
  if (!scan) return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  if (scan.paid) return NextResponse.json({ ok: true, alreadyPaid: true });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: process.env.STRIPE_PRICE_WEBSITE_REPORT, quantity: 1 }],
    customer_email: scan.email ?? undefined,
    success_url: `${siteUrl}/scan/${scan.id}?paid=1`,
    cancel_url: `${siteUrl}/scan/${scan.id}`,
    metadata: { scan_id: scan.id },
    payment_intent_data: { metadata: { scan_id: scan.id } },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Could not start checkout — try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: session.url });
}
