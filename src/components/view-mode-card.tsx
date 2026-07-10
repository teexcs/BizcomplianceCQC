'use client';

import { ArrowLeftRight, ShieldCheck, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/lib/view-mode';

export function ViewModeCard({
  currentMode,
  switchHref,
  className,
}: {
  currentMode: ViewMode;
  switchHref: string;
  className?: string;
}) {
  const isClientView = currentMode === 'client';

  return (
    <div className={cn('mx-4 rounded-xl border border-border bg-card/80 p-4 shadow-sm', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
          {isClientView ? <UserRound size={17} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">View mode</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">
            {isClientView ? 'Client view active' : 'Admin view active'}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isClientView
              ? 'This is the safe client preview. You only see the customer-facing dashboard and preview org.'
              : 'Switch to the client preview to see the customer experience without exposing admin tools.'}
          </p>
        </div>
      </div>

      <a
        href={switchHref}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <ArrowLeftRight size={14} aria-hidden="true" />
        {isClientView ? 'Return to admin' : 'Open client view'}
      </a>
    </div>
  );
}
