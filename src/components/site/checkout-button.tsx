'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { startCheckout } from '@/lib/actions/billing';
import type { BillingInterval, PlanId } from '@/lib/stripe/plans';

interface Props {
  planId: PlanId;
  label: string;
  className?: string;
  disabled?: boolean;
  billingCycle?: BillingInterval;
}

export function CheckoutButton({
  planId,
  label,
  className,
  disabled = false,
  billingCycle = 'monthly',
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    const result = await startCheckout(planId, billingCycle);
    // On success the action redirects to Stripe; reaching here means it didn't.
    if (result && !result.ok) {
      if (result.error === 'signin-required') {
        router.push(`/signup?next=${encodeURIComponent('/pricing?buy=audit')}`);
        return;
      }
      if (result.error === 'audit-required') {
        router.push('/pricing?buy=audit');
        return;
      }
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 transition-colors disabled:opacity-50',
          className ??
            'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {loading ? 'Redirecting…' : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
