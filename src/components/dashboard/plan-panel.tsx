import Link from 'next/link';
import { Check, Lock, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { FEATURE_MATRIX, formatQuota, type Entitlements } from '@/lib/plans/entitlements';

/** Compact "Your plan" panel: what this tier includes, and usage this month. */
export function PlanPanel({
  entitlements,
  requestsUsed,
}: {
  entitlements: Entitlements;
  requestsUsed: number;
}) {
  const quota = entitlements.docRequestsPerMonth;
  const showUsage = quota > 0;
  const usagePct = showUsage && quota < 999 ? Math.min(100, (requestsUsed / quota) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your plan</p>
            <h2 className="font-display text-xl tracking-tight">{entitlements.label}</h2>
          </div>
          {entitlements.tier !== 'partner' ? (
            <Link
              href="/pricing?change=1"
              className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(220,45%,40%)] hover:underline"
            >
              Compare plans <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {showUsage ? (
          <div className="mb-5">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Document requests this month</span>
              <span className="font-medium tabular-nums">
                {requestsUsed} / {formatQuota(quota)}
              </span>
            </div>
            {quota < 999 ? (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[hsl(220,45%,45%)] transition-all"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <ul className="space-y-2">
          {planHighlights(entitlements).map((row) => (
            <li key={row.label} className="flex items-center gap-2.5 text-sm">
              {row.on ? (
                <Check size={15} className="text-[hsl(152,45%,32%)] shrink-0" aria-hidden="true" />
              ) : (
                <Lock size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
              )}
              <span className={row.on ? '' : 'text-muted-foreground/70'}>
                {row.label}
                {typeof row.value === 'string' ? (
                  <span className="text-muted-foreground"> — {row.value}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {entitlements.tier === 'none' ? (
          <Link
            href="/pricing?change=1"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg h-10 text-sm font-semibold bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,20%)] transition-colors"
          >
            Add a monthly plan
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function planHighlights(e: Entitlements): { label: string; on: boolean; value?: string }[] {
  const rows: { label: string; on: boolean; value?: string }[] = [];
  for (const group of FEATURE_MATRIX) {
    for (const r of group.rows) {
      const v = r.value(e);
      if (v === false) rows.push({ label: r.label, on: false });
      else if (v === true) rows.push({ label: r.label, on: true });
      else rows.push({ label: r.label, on: true, value: v });
    }
  }
  // Keep the panel tight: show unlocked first, then a couple of locked upsells.
  const on = rows.filter((r) => r.on);
  const off = rows.filter((r) => !r.on).slice(0, 3);
  return [...on, ...off];
}
