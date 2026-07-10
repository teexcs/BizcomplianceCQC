import { TrendingDown, TrendingUp, Minus, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ScoreChange } from '@/lib/data/client';
import { formatDate } from '@/lib/utils';

/**
 * Credit-score-style explainer: the latest live-score movement and the exact
 * items that pushed it up or down, biggest movers first.
 */
export function ScoreChangePanel({ change }: { change: ScoreChange }) {
  if (change.reasons.length === 0) return null;

  const down = change.delta < 0;
  const flat = change.delta === 0;
  const deltaColor = flat
    ? 'text-muted-foreground'
    : down
      ? 'text-[hsl(4,65%,42%)]'
      : 'text-[hsl(152,45%,28%)]';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">Why your score changed</h2>
            <p className="text-xs text-muted-foreground">Updated {formatDate(change.at)}</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${deltaColor}`}>
            {flat ? (
              <Minus size={15} aria-hidden="true" />
            ) : down ? (
              <TrendingDown size={15} aria-hidden="true" />
            ) : (
              <TrendingUp size={15} aria-hidden="true" />
            )}
            {change.delta > 0 ? '+' : ''}
            {change.delta} pts
          </span>
        </div>

        <ul className="space-y-2">
          {change.reasons.slice(0, 6).map((r) => {
            const isDown = r.delta < 0;
            return (
              <li key={r.ref} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-6 w-12 shrink-0 items-center justify-center gap-0.5 rounded-md text-xs font-bold tabular-nums ${
                    isDown
                      ? 'bg-[hsl(4,72%,48%)]/[0.08] text-[hsl(4,65%,42%)]'
                      : 'bg-[hsl(152,47%,38%)]/[0.1] text-[hsl(152,45%,28%)]'
                  }`}
                >
                  {isDown ? (
                    <ArrowDownRight size={12} aria-hidden="true" />
                  ) : (
                    <ArrowUpRight size={12} aria-hidden="true" />
                  )}
                  {r.delta > 0 ? '+' : ''}
                  {r.delta}
                </span>
                <span className="text-sm leading-snug">{r.label}</span>
              </li>
            );
          })}
        </ul>

        {change.reasons.length > 6 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            +{change.reasons.length - 6} more change{change.reasons.length - 6 === 1 ? '' : 's'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
