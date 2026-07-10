'use client';

import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';

type CompanySuggestion = {
  name: string;
  companyNumber?: string;
  description?: string;
};

interface CompanyNameFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export function CompanyNameField({
  value,
  onValueChange,
  className,
  ...props
}: CompanyNameFieldProps) {
  const listId = useId().replace(/:/g, '');
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = value.trim();

    if (query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/company-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const data = (await res.json()) as { results?: CompanySuggestion[] };
        setSuggestions((data.results ?? []).slice(0, 6));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Input
        {...props}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        list={suggestions.length ? listId : undefined}
        className={className}
      />
      <datalist id={listId}>
        {suggestions.map((item) => (
          <option key={`${item.companyNumber ?? item.name}`} value={item.name}>
            {item.companyNumber ? `${item.name} (${item.companyNumber})` : item.name}
          </option>
        ))}
      </datalist>
      <p className="text-xs text-muted-foreground">
        {loading ? 'Finding company guesses...' : 'Start typing 3 letters for company guesses.'}
      </p>
    </div>
  );
}
