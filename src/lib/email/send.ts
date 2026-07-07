import 'server-only';
import { Resend } from 'resend';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Sends via Resend. If RESEND_API_KEY is not configured yet the send is
 * skipped (logged) rather than crashing user-facing flows — email is an
 * enhancement, never a gate.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" to ${to}`);
    return null;
  }
  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL!;
  const fromName = process.env.RESEND_FROM_NAME ?? 'BizCompliance';
  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo,
    });
    if (error) {
      console.error(`[email] Resend error for "${subject}": ${error.message}`);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error('[email] send failed', e);
    return null;
  }
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}
