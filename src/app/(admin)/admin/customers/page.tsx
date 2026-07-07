import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCustomers } from '@/lib/data/admin';
import { PLANS } from '@/lib/stripe/plans';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: highlightOrg } = await searchParams;
  const customers = await getCustomers();

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
        <div className="grid gap-3">
          {customers.map((c) => {
            const sub = c.subscription;
            const subActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status);
            return (
              <Card
                key={c.profile.id}
                className={
                  highlightOrg && c.organisation?.id === highlightOrg
                    ? 'ring-1 ring-[hsl(36,45%,55%)]/50'
                    : undefined
                }
              >
                <CardContent className="py-4 flex flex-wrap items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#242b38] to-[#0d1626] grid place-items-center text-[hsl(36,60%,72%)] text-xs font-bold shrink-0">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
