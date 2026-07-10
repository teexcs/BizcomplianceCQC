'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { BoxedDropdown } from '@/components/site/boxed-dropdown';

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp';

const FILE_TYPE_OPTIONS: Array<{
  label: string;
  value: string;
  help: string;
  areaCode: string | null;
}> = [
  {
    label: 'Let the system decide',
    value: '',
    help: 'The system checks the filename and readable file text before sorting.',
    areaCode: null,
  },
  {
    label: 'Policies & procedures',
    value: 'policies',
    help: 'Core policy documents and statements.',
    areaCode: '10',
  },
  {
    label: 'Safeguarding & incidents',
    value: 'safeguarding',
    help: 'Concerns, incidents, alerts and safeguarding records.',
    areaCode: '02',
  },
  {
    label: 'Staffing & recruitment',
    value: 'staffing',
    help: 'DBS, references, induction and recruitment files.',
    areaCode: '12',
  },
  {
    label: 'Training & supervision',
    value: 'training',
    help: 'Training matrices, supervision notes and appraisals.',
    areaCode: '11',
  },
  {
    label: 'Risk assessments & care plans',
    value: 'risk',
    help: 'Risk assessments, plans and review records.',
    areaCode: '04',
  },
  {
    label: 'Medicines & clinical records',
    value: 'clinical',
    help: 'Medication sheets, clinic notes and treatment records.',
    areaCode: '06',
  },
  {
    label: 'Health, safety & infection control',
    value: 'safety',
    help: 'Fire, accident, cleaning and infection control paperwork.',
    areaCode: '14',
  },
  {
    label: 'Complaints, audits & feedback',
    value: 'governance',
    help: 'Complaints, audits, governance logs and feedback.',
    areaCode: '08',
  },
  {
    label: 'Other / not sure',
    value: 'other',
    help: 'Use this when the document does not fit a standard group.',
    areaCode: null,
  },
];

type QueueItem = {
  id: string;
  file: File;
};

function makeQueueId(file: File) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`
  );
}

export function EvidenceUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState('');
  const [queuedFiles, setQueuedFiles] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function queueFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setQueuedFiles((current) => {
      const merged = [...current];
      const seen = new Set(
        merged.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`),
      );

      for (const file of Array.from(files)) {
        if (merged.length >= 10) break;
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ id: makeQueueId(file), file });
      }

      return merged;
    });

    if (inputRef.current) inputRef.current.value = '';
  }

  function removeQueuedFile(id: string) {
    const target = queuedFiles.find((item) => item.id === id);
    if (!target) return;
    if (!window.confirm(`Remove ${target.file.name} from the upload queue?`)) return;
    setQueuedFiles((current) => current.filter((item) => item.id !== id));
  }

  function clearQueue() {
    if (!queuedFiles.length) return;
    if (!window.confirm('Remove all queued files?')) return;
    setQueuedFiles([]);
  }

  async function uploadQueuedFiles(items: QueueItem[]) {
    setBusy(true);
    setMessage(null);

    let okCount = 0;
    let replacedCount = 0;
    let firstError: string | null = null;

    for (const item of items.slice(0, 10)) {
      const form = new FormData();
      form.append('file', item.file);
      const selected = FILE_TYPE_OPTIONS.find((option) => option.value === fileType);
      if (selected?.areaCode) form.append('area_code', selected.areaCode);

      try {
        const res = await fetch('/api/files/evidence', { method: 'POST', body: form });
        const json = (await res.json()) as { ok?: boolean; error?: string; replaced?: string | null };
        if (res.ok && json.ok) {
          okCount++;
          if (json.replaced) replacedCount++;
        }
        else if (!firstError) firstError = json.error ?? 'Upload failed.';
      } catch {
        if (!firstError) firstError = 'Network error — please try again.';
      }
    }

    if (okCount > 0) {
      const historyNote =
        replacedCount > 0
          ? ` ${replacedCount} previous file${replacedCount === 1 ? '' : 's'} moved to history.`
          : '';
      setMessage({
        tone: 'ok',
        text: `${okCount} file${okCount === 1 ? '' : 's'} uploaded to your vault.${historyNote}`,
      });
      router.refresh();
    }
    if (firstError) {
      setMessage((prev) =>
        prev
          ? { tone: 'error', text: `${prev.text} Some files failed: ${firstError}` }
          : { tone: 'error', text: firstError as string },
      );
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleUpload() {
    if (!queuedFiles.length) {
      setMessage({ tone: 'error', text: 'Choose at least one file first.' });
      return;
    }

    const selected = FILE_TYPE_OPTIONS.find((option) => option.value === fileType) ?? FILE_TYPE_OPTIONS[0];
    const confirmMessage =
      fileType === ''
        ? `Upload ${queuedFiles.length} file${queuedFiles.length === 1 ? '' : 's'} and let the system sort them from the filename and readable file text where possible?`
        : `Upload ${queuedFiles.length} file${queuedFiles.length === 1 ? '' : 's'} as "${selected.label}"?`;
    if (!window.confirm(confirmMessage)) return;

    await uploadQueuedFiles(queuedFiles);
    setQueuedFiles([]);
  }

  const selectedHelp =
    FILE_TYPE_OPTIONS.find((option) => option.value === fileType)?.help ??
    'The system checks the filename and readable file text before sorting.';

  return (
    <div className="space-y-5">
      <div className="grid gap-2 max-w-sm">
        <Label htmlFor="evidence-area">What are you uploading?</Label>
        <BoxedDropdown
          id="evidence-area"
          value={fileType}
          onChange={setFileType}
          placeholder="Let the system decide"
          options={FILE_TYPE_OPTIONS.map(({ label, value }) => ({ label, value }))}
        />
        <p className="text-xs text-muted-foreground">{selectedHelp}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex items-center gap-2 rounded-none border border-[hsl(220,50%,15%)] px-4 h-11 text-sm font-medium cursor-pointer transition-colors ${
            busy
              ? 'opacity-60 pointer-events-none'
              : 'text-[hsl(220,50%,15%)] hover:bg-muted/50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted'
          }`}
        >
          {busy ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <UploadCloud size={16} aria-hidden="true" />
          )}
          Add files
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => queueFiles(e.target.files)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          PDF, Word, Excel, CSV or images · up to 25MB each · max 10 queued
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Queued files</p>
          {queuedFiles.length ? (
            <button
              type="button"
              onClick={clearQueue}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              disabled={busy}
            >
              Clear queue
            </button>
          ) : null}
        </div>

        {queuedFiles.length ? (
          <div className="space-y-2">
            {queuedFiles.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-none border border-border bg-background px-4 py-3 dark:bg-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.max(1, Math.ceil(item.file.size / 1024))} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeQueuedFile(item.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-none border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-none border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            No files queued yet. Add files first, then confirm before upload.
          </div>
        )}
      </div>

      {message ? (
        <p
          role="status"
          className={`text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || queuedFiles.length === 0}
        onClick={() => void handleUpload()}
        className="inline-flex items-center justify-center rounded-none bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Upload files'}
      </button>
    </div>
  );
}
