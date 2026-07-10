import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { getPublishedReports, getSocialProfiles, hasCompletedAuditPurchase } from '@/lib/data/client';
import { PLANS } from '@/lib/stripe/plans';
import { formatDate } from '@/lib/utils';
import {
  OrganisationForm,
  ProfileForm,
  BillingPortalButton,
} from '@/components/dashboard/account-forms';
import { SocialProfilesForm } from '@/components/dashboard/social-profiles-form';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const ctx = await requireOrgSession();
  const [reports, socialProfiles, auditPurchased] = await Promise.all([
    getPublishedReports(ctx.org.id),
    getSocialProfiles(ctx.org.id),
    hasCompletedAuditPurchase(ctx.org.id),
  ]);
  const plan = ctx.testAccess ? PLANS.partner : ctx.subscription ? PLANS[ctx.subscription.plan] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business details, subscription and reports for {ctx.org.name}.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-lg tracking-tight">Subscription</h2>
            {ctx.testAccess ? (
              <Badge className="bg-purple-100 text-purple-800">Test access</Badge>
            ) : ctx.subscription ? (
              <Badge
                className={
                  ctx.subscription.status === 'active' || ctx.subscription.status === 'trialing'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }
              >
                {ctx.subscription.status.replace('_', ' ')}
              </Badge>
            ) : (
              <Badge variant="outline">No active plan</Badge>
            )}
          </div>
          {ctx.testAccess ? (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{plan?.name ?? 'Partner'}</span> test access is
                enabled for this account, so you can exercise all locked features without paying.
              </p>
              <p className="text-xs text-muted-foreground">
                This override is only active for your testing email.
              </p>
              <Link
                href="/pricing?change=1"
                className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Change plan
              </Link>
            </div>
          ) : plan && ctx.subscription ? (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{plan.name}</span> — £{plan.priceGbp}/month
                {ctx.subscription.current_period_end
                  ? ` · renews ${formatDate(ctx.subscription.current_period_end)}`
                  : ''}
                {ctx.subscription.cancel_at_period_end ? ' · cancels at period end' : ''}
              </p>
              <div className="flex flex-wrap gap-3">
                <BillingPortalButton />
                <Link
                  href="/pricing?change=1"
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Change plan
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                You&apos;re on pay-as-you-go. A monthly plan keeps your issued documents current,
                adds the compliance calendar and regulatory alerts, and covers ongoing document
                requests.
              </p>
              {auditPurchased ? (
                <Link
                  href="/pricing?change=1"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
                >
                  Change plan
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
                >
                  Book audit first
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-display text-lg tracking-tight mb-4">Audit reports</h2>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your published readiness reports will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {reports.map((r) => (
                <li key={r.id} className="py-3 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      CQC Readiness Report — v{r.version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Score {r.score}/100
                      {r.issued_at ? ` · issued ${formatDate(r.issued_at)}` : ''}
                    </p>
                  </div>
                  <a
                    href={`/api/files/download?type=report&id=${r.id}`}
                    className="text-xs text-[hsl(220,45%,45%)] hover:underline"
                  >
                    Download PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-display text-lg tracking-tight mb-4">Business details</h2>
          <OrganisationForm
            initial={{
              name: ctx.org.name,
              service_type: ctx.org.service_type,
              cqc_provider_id: ctx.org.cqc_provider_id ?? '',
              cqc_location_id: ctx.org.cqc_location_id ?? '',
              phone: ctx.org.phone ?? '',
              address_line1: ctx.org.address_line1 ?? '',
              address_line2: ctx.org.address_line2 ?? '',
              city: ctx.org.city ?? '',
              postcode: ctx.org.postcode ?? '',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-display text-lg tracking-tight mb-4">Social profiles & public accounts</h2>
          <SocialProfilesForm initialProfiles={socialProfiles} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-display text-lg tracking-tight mb-4">Your profile</h2>
          <ProfileForm initialName={ctx.profile.full_name ?? ''} email={ctx.email} />
        </CardContent>
      </Card>
    </div>
  );
}
