'use client';

import { useState, useTransition } from 'react';
import { Phone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { bookDebriefCall } from '@/lib/actions/client';

/**
 * Pro-plan debrief-call request. Shown only when the plan includes a call. A
 * solo-founder-friendly flow: the client gives preferred times, the founder
 * confirms by reply — no live calendar to run.
 */
export function DebriefCall() {
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState('');
  const [topic, setTopic] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await bookDebriefCall({ preferredTimes: times, topic });
      if (r.ok) {
        setMsg({ ok: true, text: 'Requested — we’ll confirm a time by email shortly.' });
        setTimes('');
        setTopic('');
        setOpen(false);
      } else {
        setMsg({ ok: false, text: r.error ?? 'Could not request the call.' });
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight">
            <Phone size={16} aria-hidden="true" /> Book a debrief call
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Talk through your report and action plan with the team — included in your plan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
        >
          {open ? 'Close' : 'Request a call'}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="debrief-times">When suits you?</Label>
            <Input
              id="debrief-times"
              value={times}
              onChange={(e) => setTimes(e.target.value)}
              placeholder="e.g. Tue/Wed afternoons, or Thu 10am–12pm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="debrief-topic">Anything specific to cover? (optional)</Label>
            <Textarea
              id="debrief-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-h-[64px]"
              placeholder="e.g. the safeguarding findings and what to prioritise"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending || times.trim().length < 5}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? 'Requesting…' : 'Request debrief call'}
          </button>
        </div>
      ) : null}

      {msg ? (
        <p className={`mt-2 text-sm ${msg.ok ? 'text-green-600' : 'text-destructive'}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
