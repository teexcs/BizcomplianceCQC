'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CountryOption = {
  code: string;
  label: string;
};

const REGION_NAMES = new Intl.DisplayNames(['en-GB'], { type: 'region' });

function getCountryOptions(): CountryOption[] {
  const codes: string[] = [];

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const label = REGION_NAMES.of(code);
      if (label && label !== code) {
        codes.push(code);
      }
    }
  }

  const options = codes
    .map((code) => ({
      code,
      label: code === 'GB' ? 'United Kingdom' : (REGION_NAMES.of(code) ?? code),
    }))
    .filter((item) => item.label && item.label !== item.code)
    .sort((a, b) => a.label.localeCompare(b.label));

  const ukIndex = options.findIndex((item) => item.code === 'GB');
  if (ukIndex > 0) {
    const [uk] = options.splice(ukIndex, 1);
    options.unshift(uk);
  }

  return options;
}

export const COUNTRIES = getCountryOptions();

interface CountryDropdownProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CountryDropdown({ id, value, onChange, className }: CountryDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = COUNTRIES.find((item) => item.code === value) ?? COUNTRIES[0];
  const isUk = selected?.code === 'GB';

  const filteredCountries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter((item) => item.label.toLowerCase().includes(term));
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

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
          {selected ? selected.label : 'Select your country'}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 border border-border bg-background shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)]">
          <div className="border-b border-border/70 p-3">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter countries"
              className="h-10 w-full rounded-none border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary"
            />
          </div>
          <div role="listbox" className="max-h-72 overflow-y-auto">
            {filteredCountries.length ? (
              filteredCountries.map((item) => {
                const active = item.code === value;
                return (
                  <button
                    key={item.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(item.code);
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
              })
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">No countries match that search.</div>
            )}
          </div>
        </div>
      ) : null}

      {!isUk ? <p className="mt-1 text-xs font-medium text-destructive">Coming Soon</p> : null}
    </div>
  );
}
