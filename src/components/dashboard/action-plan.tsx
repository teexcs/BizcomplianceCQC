'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, AlertTriangle, Calendar, FileWarning, Newspaper, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleActionDone } from '@/lib/actions/client';
import type { ActionItem, ActionPlan, ActionCategory } from '@/lib/data/action-plan';

const TABS: { key: ActionCategory | 'all' | 'done'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'finding', label: 'Fixes' },
  { key: 'document', label: 'Documents' },
  { key: 'cqc_change', label: 'CQC changes' },
  { key: 'calendar', label: 'Deadlines' },
  { key: 'done', label: 'Done' },
];

const CATEGORY_ICON: Record<ActionCategory, typeof AlertTriangle> = {
  finding: AlertTriangle,
  document: FileWarning,
  cqc_change: Newspaper,
  calendar: Calendar,
};

const URGENCY_STYLE: Record<string, string> = {
  now: 'text-[hsl(4,70%,45%)]',
  soon: 'text-amber-600',
  upcoming: 'text-[hsl(220,45%,40%)]',
  info: 'text-muted-foreground',
};
const URGENCY_LABEL: Record<string, string> = {
  now: 'This week',
  soon: 'Soon',
  upcoming: 'Upcoming',
  info: 'For info',
};

export function ActionPlanView({ plan }: { plan: ActionPlan }) {
  const router = useRouter();
  const [tab, setTab] = useState<ActionCategory | 'all' | 'done'>('all');
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const shown = useMemo(() => {
    if (tab === 'done') return plan.done;
    if (tab === 'all') return plan.open;
    return plan.open.filter((i) => i.category === tab);
  }, [tab, plan]);

  function toggle(item: ActionItem) {
    setBusyKey(item.key);
    start(async () => {
      await toggleActionDone({ actionKey: item.key, done: !item.done });
      setBusyKey(null);
      router.refresh();
    });
  }

  const allClear = plan.open.filter((i) => i.urgency !== 'info').length === 0;

  return (
    <div className="space-y-5">
      {/* Reassurance / next-up banner */}
      {allClear ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-5 py-4">
          <p className="text-sm font-medium text-green-700">You&apos;re on track — nothing needs action this week.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Keep your policies and records current.
            {plan.nextUp
              ? ` Next on the horizon: ${plan.nextUp.title}${plan.nextUp.dueDate ? ` (due ${new Date(plan.nextUp.dueDate).toLocaleDateString('en-GB')})` : ''}.`
              : ''}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-sm font-medium">
            {plan.counts.now} to handle this week
            {plan.counts.soon > 0 ? ` · ${plan.counts.soon} soon` : ''}
            {plan.counts.upcoming > 0 ? ` · ${plan.counts.upcoming} upcoming` : ''}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Work through the list — tick items as you complete them. Your auditor can see your progress.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const count =
            t.key === 'all'
              ? plan.open.length
              : t.key === 'done'
                ? plan.done.length
                : plan.open.filter((i) => i.category === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Items */}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {tab === 'done' ? 'Nothing marked done yet.' : 'Nothing here right now.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <li
                key={item.key}
                className={cn(
                  'rounded-xl border bg-card px-4 py-3',
                  item.evidenceRequested ? 'border-amber-500/40' : 'border-border',
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={pending && busyKey === item.key}
                    onClick={() => toggle(item)}
                    aria-pressed={item.done}
                    aria-label={item.done ? 'Mark not done' : 'Mark done'}
                    className="mt-0.5 shrink-0 disabled:opacity-50"
                  >
                    {item.done ? (
                      <CheckCircle2 size={20} className="text-green-600" aria-hidden="true" />
                    ) : (
                      <Circle size={20} className="text-muted-foreground hover:text-foreground" aria-hidden="true" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon size={13} className={URGENCY_STYLE[item.urgency]} aria-hidden="true" />
                      <p className={cn('text-sm font-medium', item.done && 'text-muted-foreground line-through')}>
                        {item.title}
                      </p>
                      <span className={cn('text-[10px] font-semibold uppercase', URGENCY_STYLE[item.urgency])}>
                        {URGENCY_LABEL[item.urgency]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-[hsl(220,45%,40%)] hover:underline"
                      >
                        Open source →
                      </a>
                    ) : null}
                    {item.evidenceRequested ? (
                      <p className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700">
                        <Upload size={12} aria-hidden="true" />
                        Your auditor asked for proof: {item.evidenceNote} Upload it in the Evidence Vault.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
