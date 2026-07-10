import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCustomers } from '@/lib/data/admin';
import { PLANS } from '@/lib/stripe/plans';
import { formatDate } from '@/lib/utils';
import type { SocialProfile, SocialProfileCategory } from '@/types/database';
import type { AdminCustomerRow } from '@/lib/data/admin';

export const dynamic = 'force-dynamic';

const SOCIAL_CATEGORY_LABELS: Record<SocialProfileCategory, string> = {
  social: 'Social platforms',
  messaging: 'Messaging',
  reviews: 'Reviews & listings',
  directory: 'Directories',
  other: 'Other accounts',
};

const SOCIAL_CATEGORY_ORDER: SocialProfileCategory[] = ['social', 'messaging', 'reviews', 'directory', 'other'];

function groupSocialProfiles(profiles: SocialProfile[]) {
  return SOCIAL_CATEGORY_ORDER.map((category) => ({
    category,
    label: SOCIAL_CATEGORY_LABELS[category],
    items: profiles.filter((profile) => profile.category === category),
  })).filter((group) => group.items.length > 0);
}

function SocialProfilesCard({
  name,
  profiles,
}: {
  name: string;
  profiles: SocialProfile[];
}) {
  const groups = groupSocialProfiles(profiles);

  return (
    <Card className="border border-border bg-muted/20">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Social profiles
            </p>
            <h2 className="mt-2 font-display text-2xl tracking-tight">{name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Grouped by channel type so you can review a busy client quickly.
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground">
            {profiles.length} profile{profiles.length === 1 ? '' : 's'}
          </Badge>
        </div>

        {groups.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <section key={group.category} className="rounded-none border border-border bg-background p-4">
                <h3 className="font-display text-lg tracking-tight">{group.label}</h3>
                <div className="mt-3 space-y-3">
                  {group.items.map((item) => (
                    <div key={item.id} className="rounded-none border border-border/70 bg-muted/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{item.platform}</p>
                          {item.label ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                          ) : null}
                        </div>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[hsl(220,60%,72%)] hover:underline shrink-0"
                          >
                            Open
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {item.handle ? <p>Handle: {item.handle}</p> : null}
                        {item.notes ? <p className="leading-relaxed">{item.notes}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No social profiles have been added for this client yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function detailValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'Not set';
}

function ClientDetailCard({ customer }: { customer: AdminCustomerRow }) {
  const org = customer.organisation;

  return (
    <Card className="border border-border bg-background">
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected client</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight">{org?.name ?? customer.profile.email}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Full client record, including contact details, subscription state and social profiles.
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground">
            {customer.socialProfiles.length} social{customer.socialProfiles.length === 1 ? '' : 's'}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-none border border-border bg-muted/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Client</p>
            <p className="mt-1 text-sm font-medium">{detailValue(customer.profile.full_name)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{customer.profile.email}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Joined {formatDate(customer.profile.created_at)}
            </p>
          </div>
          <div className="rounded-none border border-border bg-muted/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Service</p>
            <p className="mt-1 text-sm font-medium">{detailValue(org?.service_type?.replace(/-/g, ' '))}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Provider ID: {detailValue(org?.cqc_provider_id ?? undefined)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Location ID: {detailValue(org?.cqc_location_id ?? undefined)}
            </p>
          </div>
          <div className="rounded-none border border-border bg-muted/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Plan</p>
            <p className="mt-1 text-sm font-medium">
              {customer.subscription ? `${PLANS[customer.subscription.plan]?.name ?? customer.subscription.plan}` : 'No plan'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {customer.subscription ? `Status: ${customer.subscription.status}` : 'Pay-as-you-go / not active'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-none border border-border p-4">
            <h3 className="font-display text-lg tracking-tight">Contact and address</h3>
            <div className="mt-3 space-y-1 text-sm">
              <p>Email: {customer.profile.email}</p>
              <p>Phone: {detailValue(org?.phone ?? undefined)}</p>
              <p>Address line 1: {detailValue(org?.address_line1 ?? undefined)}</p>
              <p>Address line 2: {detailValue(org?.address_line2 ?? undefined)}</p>
              <p>City: {detailValue(org?.city ?? undefined)}</p>
              <p>Postcode: {detailValue(org?.postcode ?? undefined)}</p>
            </div>
          </div>

          <div className="rounded-none border border-border p-4">
            <h3 className="font-display text-lg tracking-tight">Usage</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-none border border-border/70 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Audits</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{customer.auditCount}</p>
              </div>
              <div className="rounded-none border border-border/70 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Latest score</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {typeof customer.latestScore === 'number' ? `${customer.latestScore}/100` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-tight">Social media and accounts</h3>
          {customer.socialProfiles.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {groupSocialProfiles(customer.socialProfiles).map((group) => (
                <section key={group.category} className="rounded-none border border-border p-4">
                  <h4 className="font-medium text-sm">{group.label}</h4>
                  <div className="mt-3 space-y-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="rounded-none border border-border/70 bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.platform}</p>
                            {item.label ? <p className="text-xs text-muted-foreground">{item.label}</p> : null}
                          </div>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[hsl(220,60%,72%)] hover:underline shrink-0"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          {item.handle ? <p>Handle: {item.handle}</p> : null}
                          {item.notes ? <p>{item.notes}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No social profiles added yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: highlightOrg } = await searchParams;
  const customers = await getCustomers();
  const highlightedCustomer = highlightOrg
    ? customers.find((c) => c.organisation?.id === highlightOrg)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {customers.length} registered care providers.
        </p>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No clients yet — new signups appear here automatically.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {highlightedCustomer?.organisation ? (
            <ClientDetailCard customer={highlightedCustomer} />
          ) : null}

          <div className="grid gap-3">
            {customers.map((c) => {
              const sub = c.subscription;
              const subActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status);
              return (
                <Card
                  key={c.profile.id}
                  className={
                    highlightOrg && c.organisation?.id === highlightOrg
                      ? 'ring-1 ring-[hsl(220,45%,55%)]/50'
                      : undefined
                  }
                >
                  <CardContent className="py-4 flex flex-wrap items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#242b38] to-[#0d1626] grid place-items-center text-[hsl(220,60%,72%)] text-xs font-bold shrink-0">
                      {(c.organisation?.name ?? c.profile.email)
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {c.organisation?.name ?? '(no organisation)'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {c.profile.full_name ? `${c.profile.full_name} · ` : ''}
                        {c.profile.email} ·{' '}
                        {(c.organisation?.service_type ?? '').replace(/-/g, ' ')} · joined{' '}
                        {formatDate(c.profile.created_at)}
                      </p>
                      {c.socialProfiles.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {groupSocialProfiles(c.socialProfiles)
                            .slice(0, 3)
                            .map((group) => (
                              <Badge key={group.category} variant="outline">
                                {group.label} · {group.items.length}
                              </Badge>
                            ))}
                          {c.socialProfiles.length > 3 ? (
                            <Badge variant="outline">+{c.socialProfiles.length - 3} more</Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Audits</p>
                      <p className="text-sm font-semibold tabular-nums">{c.auditCount}</p>
                    </div>
                    {typeof c.latestScore === 'number' ? (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Latest score</p>
                        <p className="text-sm font-semibold tabular-nums">{c.latestScore}/100</p>
                      </div>
                    ) : null}
                    {subActive && sub ? (
                      <Badge className="bg-green-500/15 text-green-300">
                        {PLANS[sub.plan]?.name ?? sub.plan} · £{PLANS[sub.plan]?.priceGbp ?? '—'}/mo
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pay-as-you-go</Badge>
                    )}
                    {c.organisation ? (
                      <Link
                        href={`/admin/customers?org=${c.organisation.id}`}
                        className="text-xs text-[hsl(220,60%,72%)] hover:underline shrink-0"
                      >
                        View socials
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
