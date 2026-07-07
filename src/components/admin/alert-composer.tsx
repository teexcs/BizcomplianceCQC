'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { upsertAlert } from '@/lib/actions/admin';

const CATEGORIES = ['safe', 'effective', 'caring', 'responsive', 'well-led'];

const EMPTY = { title: '', body: '', category: 'well-led', external_url: '' };

export function AlertComposer() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  function save(published: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await upsertAlert({
        title: form.title,
        body: form.body,
        category: form.category,
        external_url: form.external_url || null,
        published,
      });
      if (result.ok) {
        setMessage({
          tone: 'ok',
          text: published ? 'Alert published to all clients.' : 'Draft saved.',
        });
        setForm(EMPTY);
        router.refresh();
      } else {
        setMessage({ tone: 'error', text: result.error ?? 'Could not save the alert.' });
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-display text-lg tracking-tight">New regulatory alert</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="alert-title">Headline</Label>
          <Input
            id="alert-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. CQC updates guidance on medicines reconciliation"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-category">Key question</Label>
          <Select
            id="alert-category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-url">Source link (optional)</Label>
          <Input
            id="alert-url"
            type="url"
            value={form.external_url}
            onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
            placeholder="https://www.cqc.org.uk/…"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="alert-body">Summary for clients</Label>
          <Textarea
            id="alert-body"
            rows={3}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="What changed, who it affects, and what providers should do."
          />
        </div>
      </div>
      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message.tone === 'ok' ? 'text-green-400' : 'text-destructive'}`}
        >
          {message.text}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || form.title.length < 3 || form.body.length < 10}
          onClick={() => save(true)}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Publish to clients'}
        </button>
        <button
          type="button"
          disabled={busy || form.title.length < 3 || form.body.length < 10}
          onClick={() => save(false)}
          className="rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Save draft
        </button>
      </div>
    </div>
  );
}
