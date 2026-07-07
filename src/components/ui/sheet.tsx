import * as React from 'react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
}

export function Sheet({ open, onOpenChange, children, side = 'right' }: SheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className={cn(
          'absolute top-0 h-full w-[300px] max-w-[85vw] bg-background shadow-2xl p-6 overflow-y-auto',
          side === 'left' ? 'left-0' : 'right-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}
