import { cn } from '@/lib/utils';

/**
 * Severity-coloured score dial (shared by the website scanner and the client
 * dashboard). Deliberately harsh: CQC inspectors don't grade on a curve, so
 * neither do we. 90+ to be called compliant; the amber band is wide because
 * "mostly there" is still not there.
 */
export function scoreTone(pct: number): { ring: string; text: string; label: string } {
  if (pct >= 90)
    return { ring: 'hsl(152,47%,38%)', text: 'text-[hsl(152,45%,28%)]', label: 'Compliant' };
  if (pct >= 60)
    return { ring: 'hsl(24,85%,50%)', text: 'text-[hsl(24,80%,38%)]', label: 'Needs improvement' };
  return { ring: 'hsl(4,72%,48%)', text: 'text-[hsl(4,65%,40%)]', label: 'Critical' };
}

export function ScoreDial({
  pct,
  display,
  caption,
  size = 176,
  className,
}: {
  /** 0–100 fill percentage that drives the colour + arc. */
  pct: number;
  /** What to print in the middle, e.g. "6.5" or "76". */
  display: string;
  /** Small text under the number, e.g. "/10" or "/100". */
  caption?: string;
  size?: number;
  className?: string;
}) {
  const tone = scoreTone(pct);
  const deg = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 360);
  const thickness = Math.max(10, Math.round(size / 13));

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${display}${caption ?? ''} — ${tone.label}`}
    >
      {/* Soft tint halo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full opacity-15"
        style={{ background: tone.ring, filter: 'blur(18px)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 180deg, ${tone.ring} 0deg ${deg}deg, hsl(220,14%,91%) ${deg}deg 360deg)`,
        }}
      />
      <div
        className="absolute rounded-full bg-white grid place-items-center"
        style={{ inset: thickness }}
      >
        <div className="text-center">
          <p
            className={cn('font-display leading-none tabular-nums', tone.text)}
            style={{ fontSize: size / 3.4 }}
          >
            {display}
          </p>
          {caption ? (
            <p className="text-muted-foreground mt-1" style={{ fontSize: Math.max(10, size / 15) }}>
              {caption}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Horizontal category bar, coloured by its own score. */
export function ScoreBarRow({
  label,
  pct,
  display,
}: {
  label: string;
  pct: number;
  display: string;
}) {
  const tone = scoreTone(pct);
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-[hsl(220,25%,25%)]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(220,14%,92%)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(3, pct)}%`, background: tone.ring }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">{display}</span>
    </div>
  );
}
