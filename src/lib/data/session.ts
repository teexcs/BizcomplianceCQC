import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Organisation, Profile, Subscription } from '@/types/database';

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  org: Organisation | null;
  subscription: Subscription | null;
  isAdmin: boolean;
}

/** Loads the signed-in user with profile, organisation and subscription. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();
  if (!profile) return null;

  let org: Organisation | null = null;
  let subscription: Subscription | null = null;

  if (profile.org_id) {
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

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    org,
    subscription,
    isAdmin: profile.role === 'admin',
  };
});

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
