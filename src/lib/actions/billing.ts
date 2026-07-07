'use server';

import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe/client';
import { getStripePriceId, PLANS, type PlanId } from '@/lib/stripe/plans';
import { getSessionContext } from '@/lib/data/session';
import { createClient } from '@/lib/supabase/server';

// 'use server' files may only export async functions, so the sign-in sentinel
// is a plain string both here and in the checkout buttons: 'signin-required'.
const SIGNIN_REQUIRED = 'signin-required';

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

async function getOrCreateCustomerId(orgId: string, orgName: string, email: string): Promise<string> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string }>();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name: orgName,
    metadata: { org_id: orgId },
  });
  return customer.id;
}

/** Creates a Stripe Checkout session and redirects the browser to it. */
export async function startCheckout(planId: PlanId): Promise<{ ok: false; error: string } | never> {
  const plan = PLANS[planId];
  if (!plan) return { ok: false, error: 'Unknown plan.' };
  if (planId === 'audit') {
    const paymentLink = process.env.STRIPE_PAYMENT_LINK_AUDIT_ONEOFF;
    if (paymentLink) {
      redirect(paymentLink);
    }
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, error: 'Payments are not configured yet — please contact us to get started.' };
  }

  const session_ctx = await getSessionContext();
  if (!session_ctx || !session_ctx.org) {
    return { ok: false, error: SIGNIN_REQUIRED };
  }
  const ctx = session_ctx as typeof session_ctx & { org: NonNullable<typeof session_ctx.org> };

  let priceId: string;
  try {
    priceId = getStripePriceId(planId);
  } catch {
    return { ok: false, error: 'This plan is not available yet — please contact us.' };
  }

  const customerId = await getOrCreateCustomerId(ctx.org.id, ctx.org.name, ctx.email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: plan.cadence === 'one-off' ? 'payment' : 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/dashboard?checkout=success`,
    cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
    metadata: { org_id: ctx.org.id, user_id: ctx.userId, plan_id: planId },
    ...(plan.cadence === 'monthly'
      ? { subscription_data: { metadata: { org_id: ctx.org.id, plan_id: planId } } }
      : { payment_intent_data: { metadata: { org_id: ctx.org.id, plan_id: planId } } }),
    allow_promotion_codes: true,
  });

  if (!session.url) return { ok: false, error: 'Could not start checkout. Please try again.' };
  redirect(session.url);
}

/** Opens the Stripe customer portal for subscription management. */
export async function openBillingPortal(): Promise<{ ok: false; error: string } | never> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, error: 'Billing is not configured yet.' };
  }
  const session_ctx = await getSessionContext();
  if (!session_ctx?.org) return { ok: false, error: 'Not signed in.' };
  const ctx = session_ctx as typeof session_ctx & { org: NonNullable<typeof session_ctx.org> };
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string }>();

  if (!sub?.stripe_customer_id) {
    return { ok: false, error: 'No billing account found — purchase a plan first.' };
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${siteUrl()}/dashboard/account`,
  });
  redirect(portal.url);
}
