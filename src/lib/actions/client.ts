'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireOrgSession } from '@/lib/data/session';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, adminEmails } from '@/lib/email/send';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const requestSchema = z.object({
  type: z.string().min(2).max(80),
  priority: z.enum(['low', 'medium', 'high']),
  description: z.string().min(10).max(4000),
});

export async function submitRequest(input: z.infer<typeof requestSchema>): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please complete all fields (10+ characters for the description).' };

  const ctx = await requireOrgSession();
  if (!rateLimit(`request:${ctx.userId}`, 10, 60 * 60 * 1000)) {
    return { ok: false, error: 'Too many requests — please try again later.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('requests')
    .insert({
      org_id: ctx.org.id,
      created_by: ctx.userId,
      type: parsed.data.type,
      priority: parsed.data.priority,
      description: parsed.data.description,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: 'Could not submit your request. Please try again.' };

  const admins = adminEmails();
  if (admins.length) {
    void sendEmail({
      to: admins,
      subject: `New ${parsed.data.priority}-priority request — ${ctx.org.name}`,
      html: `<p>${ctx.org.name} submitted a "${parsed.data.type}" request.</p><p>${parsed.data.description.slice(0, 500)}</p>`,
    });
  }

  revalidatePath('/dashboard/requests');
  return { ok: true, id: data.id };
}

export async function markAlertRead(alertId: string, read: boolean): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  const supabase = await createClient();
  if (read) {
    const { error } = await supabase
      .from('alert_reads')
      .upsert({ alert_id: alertId, user_id: ctx.userId }, { onConflict: 'alert_id,user_id' });
    if (error) return { ok: false, error: 'Could not update alert.' };
  } else {
    const { error } = await supabase
      .from('alert_reads')
      .delete()
      .eq('alert_id', alertId)
      .eq('user_id', ctx.userId);
    if (error) return { ok: false, error: 'Could not update alert.' };
  }
  revalidatePath('/dashboard/alerts');
  return { ok: true };
}

const orgSchema = z.object({
  name: z.string().min(2).max(120),
  service_type: z.string().min(2).max(60),
  cqc_provider_id: z.string().max(30).optional().or(z.literal('')),
  cqc_location_id: z.string().max(30).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address_line1: z.string().max(120).optional().or(z.literal('')),
  address_line2: z.string().max(120).optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
  postcode: z.string().max(12).optional().or(z.literal('')),
});

export async function updateOrganisation(input: z.infer<typeof orgSchema>): Promise<ActionResult> {
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the business details and try again.' };

  const ctx = await requireOrgSession();
  const supabase = await createClient();
  const clean = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('organisations').update(clean).eq('id', ctx.org.id);
  if (error) return { ok: false, error: 'Could not save business details.' };

  revalidatePath('/dashboard/account');
  return { ok: true };
}

const profileSchema = z.object({
  full_name: z.string().min(1).max(120),
});

export async function updateProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please enter your name.' };

  const ctx = await requireOrgSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name })
    .eq('id', ctx.userId);
  if (error) return { ok: false, error: 'Could not save your profile.' };

  revalidatePath('/dashboard/account');
  return { ok: true };
}
