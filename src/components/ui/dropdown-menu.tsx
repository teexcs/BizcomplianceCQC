import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  children: React.ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

const DropdownMenuContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) return null;
  const child = asChild && React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          ctx.setOpen(!ctx.open);
          (children as React.ReactElement).props.onClick?.(e);
        },
      })
    : <button onClick={() => ctx.setOpen(!ctx.open)}>{children}</button>;
  return <>{child}</>;
}

export function DropdownMenuContent({ children, className, align = 'center' }: { children: React.ReactNode; className?: string; align?: 'start' | 'center' | 'end' }) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx || !ctx.open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => ctx.setOpen(false)} />
      <div
        className={cn(
          'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2',
          'top-full mt-1',
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

export function DropdownMenuItem({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <button
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      onClick={() => { onClick?.(); ctx?.setOpen(false); }}
    >
      {children}
    </button>
  );
}
