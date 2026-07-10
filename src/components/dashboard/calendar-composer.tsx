'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BoxedDropdown } from '@/components/site/boxed-dropdown';
import { createClientCalendarEntry } from '@/lib/actions/client';
import { formatDate } from '@/lib/utils';

const ENTRY_OPTIONS: Array<{
  value: 'note' | 'task' | 'reminder' | 'follow_up';
  label: string;
  help: string;
}> = [
  {
    value: 'note',
    label: 'Note',
    help: 'Quick notes for yourself or your team.',
  },
  {
    value: 'task',
    label: 'Task',
    help: 'A personal action you want to come back to.',
  },
  {
    value: 'reminder',
    label: 'Reminder',
    help: 'Something you want to remember on this date.',
  },
  {
    value: 'follow_up',
    label: 'Follow up',
    help: 'A follow-up you want the calendar to hold for you.',
  },
];

export function CalendarComposer({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'note' | 'task' | 'reminder' | 'follow_up'>('note');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [selectedDate]);

  function submit() {
    if (title.trim().length < 2) return;
    setMessage(null);
    startTransition(async () => {
      const result = await createClientCalendarEntry({
        title: title.trim(),
        description,
        kind,
        due_date: selectedDate,
      });
      if (!result.ok) {
        setMessage(result.error ?? 'Could not save your calendar item.');
        return;
      }
      setTitle('');
      setDescription('');
      setKind('note');
      setMessage('Saved to your calendar.');
      router.refresh();
    });
  }

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 border-t border-border/70 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your calendar</p>
          <h3 className="font-display text-lg tracking-tight">Add something for {selectedLabel}</h3>
        </div>
        <Badge variant="outline">Client entry</Badge>
      </div>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="client-calendar-title">Title</Label>
          <Input
            id="client-calendar-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chase missing policies"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-calendar-kind">Type</Label>
          <BoxedDropdown
            id="client-calendar-kind"
            value={kind}
            onChange={(value) => setKind(value as typeof kind)}
            placeholder="Type"
            options={ENTRY_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
          />
          <p className="text-xs text-muted-foreground">
            {ENTRY_OPTIONS.find((option) => option.value === kind)?.help}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-calendar-description">Notes</Label>
          <Textarea
            id="client-calendar-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context, next steps or a reminder for yourself."
          />
        </div>
      </div>

      <button
        type="button"
        disabled={busy || title.trim().length < 2}
        onClick={submit}
        className="inline-flex items-center gap-2 rounded-md bg-[hsl(220,50%,15%)] px-4 py-2.5 text-sm font-medium text-[hsl(36,33%,97%)] transition-colors hover:bg-[hsl(220,50%,20%)] disabled:opacity-50"
      >
        <Plus size={15} aria-hidden="true" />
        Add to calendar
      </button>

      <p className="text-xs text-muted-foreground">
        This appears on your calendar alongside items set by the admin team.
      </p>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
