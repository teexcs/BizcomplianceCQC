import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, adminEmails } from '@/lib/email/send';
import { getScan } from '@/lib/scanner/run';

export const runtime = 'nodejs';

const bodySchema = z.object({
  scanId: z.string().uuid(),
  email: z.string().email().max(200),
});

/**
 * Lead capture: stores the email on the scan and emails them their free mini
 * report (score + what's missing). The detailed fixes stay in the £8.99 report.
 */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`scan-email:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts — try again later.' }, { status: 429 });
  }

  const scan = await getScan(parsed.data.scanId);
  if (!scan) return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });

  const admin = createAdminClient();
  await admin
    .from('website_scans')
    .update({ email: parsed.data.email })
    .eq('id', parsed.data.scanId);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const failing = scan.results.filter((r) => !r.passed);
  const rows = failing
    .map(
      (r) =>
        `<tr><td style="padding:5px 0;font-size:14px;color:#333a47;">${r.label}</td><td style="padding:5px 0;text-align:right;font-size:12px;font-weight:bold;color:${r.severity === 'urgent' ? '#b63b31' : '#a96c00'};">${r.severity.toUpperCase()}</td></tr>`,
    )
    .join('');
  void sendEmail({
    to: parsed.data.email,
    subject: `Your website compliance score: ${scan.score.toFixed(1)}/10 — ${scan.domain}`,
    html: `<p style="font-size:14px;color:#333a47;">Here is your free compliance summary for <strong>${scan.domain}</strong> (${scan.pagesScanned} pages scanned):</p>
<p style="font-size:32px;font-weight:bold;margin:12px 0;color:${scan.score >= 9 ? '#1a7f4e' : scan.score >= 6 ? '#c2410c' : '#b63b31'};">${scan.score.toFixed(1)}/10</p>
<p style="font-size:14px;color:#333a47;">${scan.urgent} urgent and ${scan.important} important issues found:</p>
<table width="100%" style="border-collapse:collapse;">${rows || '<tr><td style="font-size:14px;">No failing checks — well done.</td></tr>'}</table>
<p style="font-size:14px;margin-top:18px;"><a href="${siteUrl}/scan/${scan.id}">View your full results</a> — the fix-by-fix website report is £8.99.</p>
<div style="margin-top:22px;padding:18px 20px;background:#111a2c;border-radius:10px;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8fa6d6;margin:0 0 6px;">The bigger picture</p>
  <p style="font-size:15px;font-weight:bold;color:#ffffff;margin:0 0 8px;">Your website is one small part of your CQC compliance.</p>
  <p style="font-size:13px;color:#c9d2e4;line-height:1.6;margin:0 0 14px;">A CQC inspection assesses 139 evidence points across all 18 compliance areas. Our one-off readiness audit reviews every one of them — manually — and gives you a readiness score, a priority action plan, and the documents you're missing, in 48 hours.</p>
  <a href="${siteUrl}/#start" style="display:inline-block;background:#ffffff;color:#111a2c;font-size:14px;font-weight:bold;text-decoration:none;padding:11px 20px;border-radius:8px;">Book your CQC readiness audit</a>
</div>`,
  });

  const admins = adminEmails();
  if (admins.length) {
    void sendEmail({
      to: admins,
      subject: `Scanner lead: ${parsed.data.email} (${scan.domain}, ${scan.score.toFixed(1)}/10)`,
      html: `<p>${parsed.data.email} scanned ${scan.domain} — score ${scan.score.toFixed(1)}/10, ${scan.urgent} urgent issues.</p>`,
    });
  }

  return NextResponse.json({ ok: true });
}
