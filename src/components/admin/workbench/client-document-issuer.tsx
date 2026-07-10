'use client';

import { useRef, useState } from 'react';
import { Send, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp';

export function ClientDocumentIssuer({
  auditId,
  auditStatus,
  organisationName,
}: {
  auditId: string;
  auditStatus: 'intake' | 'evidence' | 'in_review' | 'report_draft' | 'delivered' | 'closed';
  organisationName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ tone: 'error', text: 'Choose a file to send.' });
      return;
    }
    if (title.trim().length < 2) {
      setMessage({ tone: 'error', text: 'Give the document a clear title.' });
      return;
    }

    const form = new FormData();
    form.append('audit_id', auditId);
    form.append('title', title.trim());
    form.append('note', note.trim());
    form.append('file', file);

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/client-documents', {
        method: 'POST',
        body: form,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; superseded?: number };
      if (!res.ok || !json.ok) {
        setMessage({ tone: 'error', text: json.error ?? 'Could not send the document.' });
        return;
      }
      setMessage({
        tone: 'ok',
        text:
          json.superseded && json.superseded > 0
            ? `Document sent to ${organisationName}. ${json.superseded} previous version${json.superseded === 1 ? '' : 's'} moved to history.`
            : `Document sent to ${organisationName}.`,
      });
      setTitle('');
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setMessage({ tone: 'error', text: 'Network error — please try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (!['delivered', 'closed'].includes(auditStatus)) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Post-delivery document issuing unlocks after the audit is delivered.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Client document folder
          </p>
          <h3 className="font-display text-lg tracking-tight">Send a document to {organisationName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload any PDF, Word, Excel, CSV or image file after delivery and it will appear in the client&apos;s document vault.
          </p>
        </div>
        <Badge variant="outline">Delivered only</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="client-doc-title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="client-doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Medication policy update"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="client-doc-file" className="text-sm font-medium">
            File
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-4 py-2 text-sm hover:bg-muted/40">
            <UploadCloud size={16} aria-hidden="true" />
            Choose file
            <input ref={fileRef} id="client-doc-file" type="file" accept={ACCEPT} className="sr-only" />
          </label>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="client-doc-note" className="text-sm font-medium">
            Note
          </label>
          <textarea
            id="client-doc-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note shown to the client."
            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {message ? (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}>
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="inline-flex items-center gap-2 rounded-md bg-[hsl(220,50%,15%)] px-4 py-2.5 text-sm font-medium text-[hsl(36,33%,97%)] transition-colors hover:bg-[hsl(220,50%,20%)] disabled:opacity-50"
      >
        <Send size={15} aria-hidden="true" />
        {busy ? 'Sending…' : 'Send to client folder'}
      </button>
    </div>
  );
}
