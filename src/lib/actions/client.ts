'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { requireOrgSession, getRequestUsageThisMonth } from '@/lib/data/session';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, adminEmails } from '@/lib/email/send';
import { formatQuota } from '@/lib/plans/entitlements';
import { startAuditForOrg } from '@/lib/audit/start';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const actionToggleSchema = z.object({
  actionKey: z.string().min(3).max(200),
  done: z.boolean(),
});

/**
 * Tick an Action Plan item done (or un-tick it). Upserts the per-org progress
 * row keyed by the stable action key. Derived items keep their state across
 * recomputes because the key is stable.
 */
export async function toggleActionDone(
  input: z.infer<typeof actionToggleSchema>,
): Promise<ActionResult> {
  const parsed = actionToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid action.' };
  const ctx = await requireOrgSession();
  const supabase = await createClient();

  const { error } = await supabase.from('action_states').upsert(
    {
      org_id: ctx.org.id,
      action_key: parsed.data.actionKey,
      done: parsed.data.done,
      done_at: parsed.data.done ? new Date().toISOString() : null,
      done_by: parsed.data.done ? ctx.userId : null,
    },
    { onConflict: 'org_id,action_key' },
  );
  if (error) return { ok: false, error: 'Could not update the task.' };

  revalidatePath('/dashboard/action-plan');
  revalidatePath('/dashboard');
  return { ok: true };
}

const requestSchema = z.object({
  type: z.string().min(2).max(80),
  priority: z.enum(['low', 'medium', 'high']),
  description: z.string().min(10).max(4000),
});

export async function startClientAudit(): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!rateLimit(`start-audit:${ctx.userId}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: 'Too many audit starts — please try again later.' };
  }

  try {
    const { audit } = await startAuditForOrg({
      orgId: ctx.org.id,
      orgName: ctx.org.name,
      forceNew: false,
      autoCreated: false,
      taskTitle: `Run CQC readiness audit - ${ctx.org.name}`,
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/evidence');
    revalidatePath('/admin');
    revalidatePath('/admin/audits');
    return { ok: true, id: audit.id };
  } catch (e) {
    console.error('[client] audit start failed', e);
    return { ok: false, error: 'Could not start the audit.' };
  }
}

export async function submitRequest(input: z.infer<typeof requestSchema>): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please complete all fields (10+ characters for the description).' };

  const ctx = await requireOrgSession();
  if (!rateLimit(`request:${ctx.userId}`, 10, 60 * 60 * 1000)) {
    return { ok: false, error: 'Too many requests — please try again later.' };
  }

  // Plan quota: document/support requests are a subscription entitlement.
  const quota = ctx.entitlements.docRequestsPerMonth;
  if (quota <= 0) {
    return {
      ok: false,
      error:
        'Document requests are part of a monthly plan. Add a plan from your account to start requesting document updates and support.',
    };
  }
  const used = await getRequestUsageThisMonth(ctx.org.id);
  if (used >= quota) {
    return {
      ok: false,
      error: `You've used all ${formatQuota(quota)} of this month's requests on the ${ctx.entitlements.label} plan. Upgrade for more, or they reset next month.`,
    };
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

const clientCalendarSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  kind: z.enum(['note', 'task', 'reminder', 'follow_up']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createClientCalendarEntry(
  input: z.infer<typeof clientCalendarSchema>,
): Promise<ActionResult> {
  const parsed = clientCalendarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please complete the calendar entry details.' };

  const ctx = await requireOrgSession();
  const supabase = createAdminClient();
  const { error } = await supabase.from('calendar_events').insert({
    org_id: ctx.org.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    event_type: parsed.data.kind,
    due_date: parsed.data.due_date,
    source: 'client',
    created_by: ctx.userId,
  });

  if (error) return { ok: false, error: 'Could not save your calendar item.' };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/calendar');
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

const socialProfileSchema = z.object({
  category: z.enum(['social', 'messaging', 'reviews', 'directory', 'other']),
  platform: z.string().min(1).max(80),
  label: z.string().max(120).optional().or(z.literal('')),
  handle: z.string().max(160).optional().or(z.literal('')),
  url: z.string().max(300).optional().or(z.literal('')),
  notes: z.string().max(300).optional().or(z.literal('')),
});

const socialProfilesSaveSchema = z.object({
  profiles: z.array(socialProfileSchema),
});

export async function saveSocialProfiles(
  input: z.infer<typeof socialProfilesSaveSchema>,
): Promise<ActionResult> {
  const parsed = socialProfilesSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the social profiles and try again.' };

  const ctx = await requireOrgSession();
  const supabase = createAdminClient();
  const profiles = parsed.data.profiles
    .map((row, index) => ({
      org_id: ctx.org.id,
      category: row.category,
      platform: row.platform.trim(),
      label: row.label?.trim() || null,
      handle: row.handle?.trim() || null,
      url: row.url?.trim() || null,
      notes: row.notes?.trim() || null,
      sort: index,
    }))
    .filter((row) => row.platform.length > 0);

  const { error: deleteError } = await supabase
    .from('social_profiles')
    .delete()
    .eq('org_id', ctx.org.id);
  if (deleteError) return { ok: false, error: 'Could not update the social profiles.' };

  if (profiles.length) {
    const { error: insertError } = await supabase.from('social_profiles').insert(profiles);
    if (insertError) return { ok: false, error: 'Could not update the social profiles.' };
  }

  revalidatePath('/dashboard/account');
  revalidatePath('/admin/customers');
  return { ok: true };
}
