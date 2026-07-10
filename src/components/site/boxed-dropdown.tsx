'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DropdownOption = {
  value: string;
  label: string;
};

interface BoxedDropdownProps {
  id: string;
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}

export function BoxedDropdown({
  id,
  value,
  options,
  placeholder,
  onChange,
  className,
}: BoxedDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((item) => item.value === value) ?? null;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-3 rounded-none border border-border bg-background px-3 text-left text-sm text-foreground shadow-none transition-colors focus-visible:outline-none focus-visible:border-primary',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 border border-border bg-background shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)]">
          <div role="listbox" className="max-h-72 overflow-y-auto">
            {options.map((item) => {
              const active = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted',
                    active && 'bg-muted',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {active ? <Check size={15} className="shrink-0 text-primary" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
