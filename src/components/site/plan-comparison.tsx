import { Check, Minus } from 'lucide-react';
import { ENTITLEMENTS, FEATURE_MATRIX, type PlanTier } from '@/lib/plans/entitlements';

const TIERS: PlanTier[] = ['essentials', 'professional', 'partner'];

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <span className="inline-flex justify-center w-full">
        <Check size={17} className="text-[hsl(152,45%,32%)]" aria-label="Included" />
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex justify-center w-full">
        <Minus size={16} className="text-muted-foreground/40" aria-label="Not included" />
      </span>
    );
  return <span className="block text-center text-sm font-medium">{value}</span>;
}

/** Full structured feature matrix comparing the three monthly tiers. */
export function PlanComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="text-left font-medium p-4 w-[38%]">
              Compare plans
            </th>
            {TIERS.map((t) => (
              <th key={t} scope="col" className="p-4 text-center">
                <span className="font-display text-base tracking-tight">
                  {ENTITLEMENTS[t].label}
                </span>
                {t === 'partner' ? (
                  <span className="block mt-1 text-[10px] font-sans font-semibold uppercase tracking-wide text-muted-foreground">
                    Coming soon
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((group) => (
            <FeatureGroupRows key={group.group} group={group} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureGroupRows({
  group,
}: {
  group: (typeof FEATURE_MATRIX)[number];
}) {
  return (
    <>
      <tr className="bg-muted/20">
        <th
          scope="colgroup"
          colSpan={4}
          className="text-left px-4 pt-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {group.group}
        </th>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.label} className="border-b border-border/60 last:border-0">
          <th scope="row" className="text-left font-normal p-4 text-foreground">
            {row.label}
          </th>
          {TIERS.map((t) => (
            <td key={t} className="p-4">
              <Cell value={row.value(ENTITLEMENTS[t])} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
