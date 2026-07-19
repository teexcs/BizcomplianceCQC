'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { requestActionEvidence, clearActionEvidenceRequest } from '@/lib/actions/admin';
import type { ActionItem, ActionPlan } from '@/lib/data/action-plan';

/**
 * Admin mirror of the client's Action Plan. The auditor sees the same list, what
 * the client has TICKED DONE, and can REQUEST EVIDENCE that a done item was
 * really completed — closing the "they said they did it, prove it" loop.
 */
export function AdminActionPlan({ orgId, plan }: { orgId: string; plan: ActionPlan }) {
  const router = useRouter();
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [pending, start] = useTransition();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const list = useMemo(() => (tab === 'done' ? plan.done : plan.open), [tab, plan]);

  function request(item: ActionItem) {
    start(async () => {
      await requestActionEvidence({ orgId, actionKey: item.key, note: note.trim() || undefined });
      setNoteFor(null);
      setNote('');
      router.refresh();
    });
  }
  function clearReq(item: ActionItem) {
    start(async () => {
      await clearActionEvidenceRequest(orgId, item.key);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium">Client Action Plan (what they see)</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {plan.open.length} open · {plan.done.length} marked done by the client. Request evidence to
          verify a done item was really completed.
        </p>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab('open')}
          className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'open' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
        >
          Open ({plan.open.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('done')}
          className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tab === 'done' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
        >
          Ticked done ({plan.done.length})
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {tab === 'done' ? 'The client hasn’t marked anything done yet.' : 'No open items.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((item) => (
            <li key={item.key} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-start gap-3">
                {item.done ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
                ) : (
                  <Circle size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', item.done && 'line-through text-muted-foreground')}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  {item.done && item.doneAt ? (
                    <p className="mt-1 text-[11px] text-green-700">
                      Marked done {new Date(item.doneAt).toLocaleDateString('en-GB')}
                    </p>
                  ) : null}

                  {item.evidenceRequested ? (
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700">
                      <Upload size={12} aria-hidden="true" />
                      Evidence requested: {item.evidenceNote}
                      <button type="button" onClick={() => clearReq(item)} disabled={pending} className="ml-auto hover:text-foreground">
                        <X size={12} aria-hidden="true" /> clear
                      </button>
                    </div>
                  ) : noteFor === item.key ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What proof do you need? (optional)"
                        className="h-8 flex-1 min-w-[200px] rounded-md border border-border bg-background px-2 text-xs"
                      />
                      <button type="button" onClick={() => request(item)} disabled={pending} className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50">
                        Request
                      </button>
                      <button type="button" onClick={() => { setNoteFor(null); setNote(''); }} className="text-[11px] text-muted-foreground">
                        cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setNoteFor(item.key); setNote(''); }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted"
                    >
                      <Upload size={12} aria-hidden="true" /> Request evidence
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
