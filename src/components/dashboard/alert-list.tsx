'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { markAlertRead } from '@/lib/actions/client';
import { formatDate } from '@/lib/utils';

const CATEGORY_STYLES: Record<string, string> = {
  safe: 'bg-blue-100 text-blue-800',
  effective: 'bg-teal-100 text-teal-800',
  caring: 'bg-purple-100 text-purple-800',
  responsive: 'bg-amber-100 text-amber-800',
  'well-led': 'bg-green-100 text-green-800',
};

export interface AlertRow {
  id: string;
  title: string;
  body: string;
  category: string;
  external_url: string | null;
  published_at: string | null;
  isRead: boolean;
}

export function AlertList({ alerts }: { alerts: AlertRow[] }) {
  const [items, setItems] = useState(alerts);
  const [, startTransition] = useTransition();

  function toggle(alert: AlertRow) {
    const next = !alert.isRead;
    setItems((prev) => prev.map((a) => (a.id === alert.id ? { ...a, isRead: next } : a)));
    startTransition(() => {
      void markAlertRead(alert.id, next);
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        No regulatory alerts right now — you&apos;re up to date.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className={`py-4 ${a.isRead ? 'opacity-70' : ''}`}>
          <div className="flex flex-wrap items-center gap-3">
            {!a.isRead ? (
              <span
                className="h-2 w-2 rounded-full bg-[hsl(36,45%,45%)] shrink-0"
                aria-hidden="true"
              />
            ) : null}
            <p className="text-sm font-medium flex-1 min-w-0">{a.title}</p>
            <Badge className={CATEGORY_STYLES[a.category.toLowerCase()] ?? 'bg-muted'}>
              {a.category}
            </Badge>
            <button
              type="button"
              onClick={() => toggle(a)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Mark as {a.isRead ? 'unread' : 'read'}
            </button>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{a.body}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            {a.published_at ? <span>{formatDate(a.published_at)}</span> : null}
            {a.external_url ? (
              <a
                href={a.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(36,45%,45%)] hover:underline"
              >
                Read more
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
