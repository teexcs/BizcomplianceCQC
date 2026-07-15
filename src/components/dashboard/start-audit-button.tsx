'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { startClientAudit } from '@/lib/actions/client';

export function StartAuditButton({ label = 'Start audit workspace' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startClientAudit();
            if (!result.ok) {
              setError(result.error ?? 'Could not start the audit.');
              return;
            }
            router.push('/dashboard/evidence');
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-2 rounded-md bg-[hsl(220,50%,15%)] px-6 py-3 text-sm font-medium text-[hsl(36,33%,97%)] transition-colors hover:bg-[hsl(220,50%,15%)]/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
        {label}
        {!pending ? <ArrowRight size={16} aria-hidden="true" /> : null}
      </button>
      {error ? <p className="max-w-sm text-center text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
