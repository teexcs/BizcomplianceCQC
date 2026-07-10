import 'server-only';
import { randomUUID } from 'crypto';
import { cache } from 'react';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Organisation, Profile, Subscription } from '@/types/database';
import {
  entitlementsFor,
  ENTITLEMENTS,
  type Entitlements,
} from '@/lib/plans/entitlements';
import { getViewMode } from '@/lib/view-mode';

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  org: Organisation | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  testAccess: boolean;
  /** Resolved from the active subscription (or pay-as-you-go). */
  entitlements: Entitlements;
}

const DEFAULT_TEST_ACCESS_EMAILS = ['iammoreava@outlook.com'];
const PREVIEW_ORG_NAME = 'Client Preview';
const PREVIEW_ORG_SERVICE_TYPE = 'Preview';

function testAccessEmails(): Set<string> {
  return new Set(
    [...DEFAULT_TEST_ACCESS_EMAILS, ...(process.env.TEST_ACCESS_EMAILS ?? '').split(',')]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function loadOrCreatePreviewOrg(userId: string): Promise<Organisation | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('organisations')
    .select('*')
    .eq('owner_id', userId)
    .eq('service_type', PREVIEW_ORG_SERVICE_TYPE)
    .maybeSingle<Organisation>();

  if (existing) return existing;

  const { data: created, error } = await admin
    .from('organisations')
    .insert({
      id: randomUUID(),
      name: PREVIEW_ORG_NAME,
      service_type: PREVIEW_ORG_SERVICE_TYPE,
      cqc_provider_id: null,
      cqc_location_id: null,
      phone: null,
      address_line1: null,
      address_line2: null,
      city: null,
      postcode: null,
      owner_id: userId,
    })
    .select('*')
    .single<Organisation>();

  if (error) {
    console.error('[session] could not create preview organisation', error);
    return null;
  }

  return created ?? null;
}

/** Loads the signed-in user with profile, organisation and subscription. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const viewMode = await getViewMode();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) {
    const configuredAdminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = (user.email ?? '').toLowerCase();

    if (userEmail && configuredAdminEmails.includes(userEmail)) {
      const admin = createAdminClient();
      const { error: bootstrapError } = await admin.from('profiles').upsert(
        {
          id: user.id,
          email: user.email ?? userEmail,
          full_name: user.user_metadata?.full_name ?? null,
          role: 'admin',
          org_id: null,
        },
        { onConflict: 'id' },
      );

      if (!bootstrapError) {
        const { data: bootstrappedProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single<Profile>();
        if (bootstrappedProfile) {
          const isPreviewMode = viewMode === 'client' && bootstrappedProfile.role === 'admin';
          const previewOrg = isPreviewMode ? await loadOrCreatePreviewOrg(user.id) : null;
          const isTestAccess =
            isPreviewMode ||
            testAccessEmails().has((user.email ?? bootstrappedProfile.email).toLowerCase());
          return {
            userId: user.id,
            email: user.email ?? bootstrappedProfile.email,
            profile: bootstrappedProfile,
            org: previewOrg,
            subscription: null,
            isAdmin: bootstrappedProfile.role === 'admin',
            testAccess: isTestAccess,
            entitlements: isTestAccess ? ENTITLEMENTS.partner : ENTITLEMENTS.none,
          };
        }
      }
    }

    return null;
  }

  let org: Organisation | null = null;
  let subscription: Subscription | null = null;
  const isAdminPreview = profile.role === 'admin' && viewMode === 'client';

  if (isAdminPreview) {
    org = await loadOrCreatePreviewOrg(user.id);
  } else if (profile.org_id) {
    const [orgRes, subRes] = await Promise.all([
      supabase.from('organisations').select('*').eq('id', profile.org_id).single<Organisation>(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('org_id', profile.org_id)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<Subscription>(),
    ]);
    org = orgRes.data ?? null;
    subscription = subRes.data ?? null;
  }

  // Entitlements resolve from the active subscription; a past_due sub still
  // grants access (Stripe is retrying) — cancelled/none falls back to pay-as-you-go.
  const activePlan =
    subscription && ['active', 'trialing', 'past_due'].includes(subscription.status)
      ? subscription.plan
      : null;
  const isTestAccess =
    isAdminPreview || testAccessEmails().has((user.email ?? profile.email).toLowerCase());

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    org,
    subscription,
    isAdmin: profile.role === 'admin',
    testAccess: isTestAccess,
    entitlements: isTestAccess ? ENTITLEMENTS.partner : entitlementsFor(activePlan),
  };
});

/** Document/support requests this org has created in the current calendar month. */
export async function getRequestUsageThisMonth(orgId: string): Promise<number> {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', monthStart.toISOString());
  return count ?? 0;
}

/** Guard for server components/actions that require a signed-in client with an org. */
export async function requireOrgSession(): Promise<SessionContext & { org: Organisation }> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.org) throw new Error('Not signed in');
  return ctx as SessionContext & { org: Organisation };
}

/** Guard for admin-only server components/actions (defence in depth over middleware). */
export async function requireAdminSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.isAdmin) throw new Error('Not authorised');
  return ctx;
}
