'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

const welcomeSchema = z.object({
  businessName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  serviceType: z.string().min(1).max(80).optional(),
});

export async function sendWelcomeEmail(
  input: z.infer<typeof welcomeSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = welcomeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Could not send the welcome email.' };

  const tpl = welcomeEmail(parsed.data.businessName, parsed.data.serviceType ?? undefined);
  await sendEmail({ to: parsed.data.email, subject: tpl.subject, html: tpl.html });

  return { ok: true };
}
