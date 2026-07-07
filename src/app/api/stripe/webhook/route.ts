import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/server';
import { PLANS, type PlanId } from '@/lib/stripe/plans';
import { sendEmail, adminEmails } from '@/lib/email/send';
import {
  auditPurchasedEmail,
  auditPurchasedAdminEmail,
  subscriptionStartedEmail,
} from '@/lib/email/templates';

export const runtime = 'nodejs';

const AUDIT_TURNAROUND_HOURS = 48;

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: record the event id; a duplicate delivery is acknowledged and skipped.
  const { error: dupeError } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  if (dupeError) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(supabase, sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(`[stripe] handler failed for ${event.type}`, e);
    // Return 500 so Stripe retries; remove the idempotency marker first.
    await supabase.from('stripe_events').delete().eq('id', event.id);
    return NextResponse.json({ error: 'Handler failure' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleCheckoutCompleted(supabase: AdminClient, session: Stripe.Checkout.Session) {
  let orgId = session.metadata?.org_id ?? null;
  let planId = session.metadata?.plan_id as PlanId | undefined;
  let org: { id: string; name: string; owner_id: string } | null = null;

  if (orgId && planId) {
    const { data } = await supabase
      .from('organisations')
      .select('id, name, owner_id')
      .eq('id', orgId)
      .maybeSingle<{ id: string; name: string; owner_id: string }>();
    org = data ?? null;
  }

  if (!org || !orgId || !planId) {
    const payerEmail = session.customer_details?.email ?? session.customer_email ?? null;
    if (payerEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, org_id, email')
        .eq('email', payerEmail)
        .maybeSingle<{ id: string; org_id: string | null; email: string }>();
      if (profile) {
        if (!orgId && profile.org_id) {
          orgId = profile.org_id;
        }
        if (!orgId) {
          const { data } = await supabase
            .from('organisations')
            .select('id, name, owner_id')
            .eq('owner_id', profile.id)
            .maybeSingle<{ id: string; name: string; owner_id: string }>();
          org = data ?? null;
          orgId = org?.id ?? null;
        } else if (!org) {
          const { data } = await supabase
            .from('organisations')
            .select('id, name, owner_id')
            .eq('id', orgId)
            .maybeSingle<{ id: string; name: string; owner_id: string }>();
          org = data ?? null;
        }
      }
    }
  }

  if (!org || !orgId) {
    console.error('[stripe] checkout.session.completed could not resolve organisation', {
      sessionId: session.id,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      paymentLink: session.payment_link,
      metadata: session.metadata,
    });
    return;
  }

  if (!planId) {
    planId = 'audit';
  }

  if (session.mode === 'payment') {
    // One-off CQC Readiness Audit.
    const { data: purchase } = await supabase
      .from('purchases')
      .insert({
        org_id: orgId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        product: planId,
        amount_pence: session.amount_total ?? 0,
        status: 'paid',
      })
      .select('id')
      .single<{ id: string }>();

    const dueAt = new Date(Date.now() + AUDIT_TURNAROUND_HOURS * 3600 * 1000).toISOString();
    const { data: audit } = await supabase
      .from('audits')
      .insert({
        org_id: orgId,
        kind: 'one_off',
        status: 'evidence',
        purchase_id: purchase?.id ?? null,
        due_at: dueAt,
      })
      .select('id')
      .single<{ id: string }>();

    if (audit) {
      // Snapshot the 139-item checklist + 18 areas + 68 SAF questions.
      const { error: snapErr } = await supabase.rpc('build_audit_snapshot', { p_audit_id: audit.id });
      if (snapErr) console.error('[stripe] build_audit_snapshot failed', snapErr.message);

      await supabase.from('tasks').insert({
        title: `Run CQC readiness audit — ${org.name}`,
        org_id: orgId,
        audit_id: audit.id,
        kind: 'audit',
        priority: 'high',
        due_date: dueAt.slice(0, 10),
      });
    }

    const { data: owner } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', org.owner_id)
      .single<{ email: string }>();
    if (owner?.email) {
      const tpl = auditPurchasedEmail(org.name);
      void sendEmail({ to: owner.email, subject: tpl.subject, html: tpl.html });
    }
    const admins = adminEmails();
    if (admins.length) {
      const tpl = auditPurchasedAdminEmail(org.name, orgId);
      void sendEmail({ to: admins, subject: tpl.subject, html: tpl.html });
    }
  } else if (session.mode === 'subscription' && session.subscription) {
    const subId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    await syncSubscription(supabase, sub);

    const { data: owner } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', org.owner_id)
      .single<{ email: string }>();
    if (owner?.email) {
      const tpl = subscriptionStartedEmail(org.name, PLANS[planId]?.name ?? planId);
      void sendEmail({ to: owner.email, subject: tpl.subject, html: tpl.html });
    }
  }

  await supabase.from('activity_log').insert({
    org_id: orgId,
    action: 'checkout.completed',
    entity: 'stripe_checkout_session',
    entity_id: session.id,
    meta: { plan: planId, mode: session.mode, amount: session.amount_total },
  });
}

async function syncSubscription(supabase: AdminClient, sub: Stripe.Subscription) {
  const orgId = sub.metadata?.org_id;
  const planId = (sub.metadata?.plan_id as PlanId | undefined) ?? 'essentials';
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  let resolvedOrgId: string | undefined = orgId;
  if (!resolvedOrgId) {
    // Fall back to the customer's stored org mapping.
    const { data } = await supabase
      .from('subscriptions')
      .select('org_id')
      .eq('stripe_customer_id', customerId)
      .limit(1)
      .maybeSingle<{ org_id: string }>();
    resolvedOrgId = data?.org_id;
  }
  if (!resolvedOrgId) {
    console.error('[stripe] cannot resolve org for subscription', sub.id);
    return;
  }

  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEnd =
    item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;

  await supabase.from('subscriptions').upsert(
    {
      org_id: resolvedOrgId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan: planId,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: 'stripe_subscription_id' },
  );
}
