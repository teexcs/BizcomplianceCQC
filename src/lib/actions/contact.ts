'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, adminEmails } from '@/lib/email/send';
import { contactNotificationEmail } from '@/lib/email/templates';

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(5000),
  // Honeypot — real users never fill this.
  website: z.string().max(0).optional().or(z.literal('')),
});

export async function submitContactForm(
  input: z.infer<typeof contactSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Please complete all fields with a valid email address.' };
  }
  if (parsed.data.website) return { ok: true }; // silently drop bots

  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: 'Too many messages — please try again later.' };
  }

  // Contact form is public: writes go through the service role, table stays
  // locked to admin reads only.
  const supabase = createAdminClient();
  const { error } = await supabase.from('contact_messages').insert({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
  });
  if (error) return { ok: false, error: 'Could not send your message. Please email us directly.' };

  const admins = adminEmails();
  if (admins.length) {
    const tpl = contactNotificationEmail(
      parsed.data.name,
      parsed.data.email,
      parsed.data.subject,
      parsed.data.message,
    );
    void sendEmail({ to: admins, subject: tpl.subject, html: tpl.html, replyTo: parsed.data.email });
  }

  return { ok: true };
}
