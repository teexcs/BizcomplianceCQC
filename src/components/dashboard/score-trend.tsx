import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ScoreTrendPoint, Benchmark } from '@/lib/data/client';

/** Score-over-time sparkline plus cohort benchmark — no chart library. */
export function ScoreTrend({
  trend,
  benchmark,
}: {
  trend: ScoreTrendPoint[];
  benchmark: Benchmark | null;
}) {
  if (trend.length === 0) return null;

  const latest = trend[trend.length - 1].score;
  const first = trend[0].score;
  const delta = latest - first;
  const showTrend = trend.length >= 2;

  const max = 100;
  const points = trend.map((p, i) => {
    const x = trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100;
    const y = 100 - (p.score / max) * 100;
    return `${x},${y}`;
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg tracking-tight">Readiness over time</h2>
          {showTrend ? (
            <span
              className={`inline-flex items-center gap-1 text-sm font-medium ${
                delta > 0
                  ? 'text-[hsl(152,45%,32%)]'
                  : delta < 0
                    ? 'text-[hsl(8,60%,42%)]'
                    : 'text-muted-foreground'
              }`}
            >
              {delta > 0 ? (
                <TrendingUp size={15} aria-hidden="true" />
              ) : delta < 0 ? (
                <TrendingDown size={15} aria-hidden="true" />
              ) : (
                <Minus size={15} aria-hidden="true" />
              )}
              {delta > 0 ? '+' : ''}
              {delta} pts
            </span>
          ) : null}
        </div>

        {showTrend ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-24" role="img" aria-label="Readiness score trend">
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke="hsl(220,45%,45%)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {trend.map((p, i) => {
              const x = trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100;
              const y = 100 - (p.score / max) * 100;
              return (
                <circle
                  key={p.auditId}
                  cx={x}
                  cy={y}
                  r="2"
                  fill="hsl(220,45%,45%)"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Your score trend appears here after your next re-audit.
          </p>
        )}

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="font-display text-2xl tabular-nums">{latest}/100</p>
          </div>
          {benchmark ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                vs {benchmark.cohortSize.toLocaleString('en-GB')} audited services
              </p>
              <p className="text-sm font-medium">
                {benchmark.percentile >= 50
                  ? `Top ${100 - benchmark.percentile}%`
                  : `${benchmark.percentile}th percentile`}{' '}
                <span className="text-muted-foreground">· avg {benchmark.cohortAverage}</span>
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
