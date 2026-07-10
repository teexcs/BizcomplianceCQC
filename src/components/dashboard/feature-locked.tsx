import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Full-page gate shown when a client hits a feature above their plan. */
export function FeatureLocked({
  title,
  requiredPlan,
  description,
}: {
  title: string;
  requiredPlan: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl mx-auto py-16">
      <Card>
        <CardContent className="py-14 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted grid place-items-center">
            <Lock className="text-muted-foreground" size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              {description}
            </p>
          </div>
          <p className="text-sm">
            Included from the{' '}
            <span className="font-semibold text-foreground">{requiredPlan}</span> plan.
          </p>
          <Link
            href="/pricing?change=1"
            className="inline-flex items-center justify-center rounded-lg h-11 px-7 text-sm font-semibold bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,20%)] transition-colors"
          >
            View plans
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
