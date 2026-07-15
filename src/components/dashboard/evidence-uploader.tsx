'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, UploadCloud, FolderUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { BoxedDropdown } from '@/components/site/boxed-dropdown';
import { startClientAudit } from '@/lib/actions/client';
import type { EvidenceFile } from '@/types/database';

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp';
const ACCEPT_EXT = ACCEPT.split(',').map((e) => e.trim().toLowerCase());

/** True when a file has one of the accepted extensions — used to filter folders. */
function isAccepted(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPT_EXT.some((ext) => lower.endsWith(ext));
}

/**
 * Recursively read every file from a drag-and-drop of files AND folders.
 * Uses the webkit directory-entry API where available (Chrome, Edge, Safari),
 * falling back to the flat file list (Firefox drops files but not folders).
 */
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []);
  const supportsEntries =
    items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';

  if (!supportsEntries) {
    return Array.from(dt.files ?? []);
  }

  const out: File[] = [];

  function readEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      return new Promise<void>((resolve) => {
        (entry as FileSystemFileEntry).file((file) => {
          out.push(file);
          resolve();
        }, () => resolve());
      });
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      return new Promise<void>((resolve) => {
        // readEntries returns results in batches; keep calling until empty.
        const batch: FileSystemEntry[] = [];
        function readBatch() {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) {
              await Promise.all(batch.map(readEntry));
              resolve();
              return;
            }
            batch.push(...entries);
            readBatch();
          }, () => resolve());
        }
        readBatch();
      });
    }
    return Promise.resolve();
  }

  const entries = items
    .map((it) => it.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));
  await Promise.all(entries.map(readEntry));

  // If entry-reading yielded nothing (edge cases), fall back to the flat list.
  return out.length > 0 ? out : Array.from(dt.files ?? []);
}

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

type UploadedFilePreview = Pick<EvidenceFile, 'id' | 'file_name' | 'size_bytes'>;

function makeQueueId(file: File) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`
  );
}

function normalizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/\bcopy\b/g, '')
    .replace(/\bduplicate\b/g, '')
    .replace(/\(\d+\)$/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/[^\w\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function EvidenceUploader({
  existingFiles,
  activeAuditId,
}: {
  existingFiles: UploadedFilePreview[];
  activeAuditId?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [auditId, setAuditId] = useState(activeAuditId ?? null);
  const [fileType, setFileType] = useState('');
  const [queuedFiles, setQueuedFiles] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const duplicateLookup = useMemo(() => {
    const existing = new Set(existingFiles.map((file) => normalizeFileName(file.file_name)));
    const queueCounts = new Map<string, number>();

    for (const item of queuedFiles) {
      const key = normalizeFileName(item.file.name);
      queueCounts.set(key, (queueCounts.get(key) ?? 0) + 1);
    }

    return new Map(
      queuedFiles.map((item) => {
        const key = normalizeFileName(item.file.name);
        const inVault = existing.has(key);
        const inBatch = (queueCounts.get(key) ?? 0) > 1;
        return [
          item.id,
          {
            duplicate: inVault || inBatch,
            inVault,
            inBatch,
          },
        ] as const;
      }),
    );
  }, [existingFiles, queuedFiles]);

  const duplicateCount = Array.from(duplicateLookup.values()).filter((item) => item.duplicate).length;

  function queueFiles(files: FileList | File[] | null) {
    if (!files) return;
    const all = Array.from(files);
    if (all.length === 0) return;

    // Drop anything that isn't an accepted type (common when a whole folder is
    // dropped) and count it so the client knows what was ignored.
    const accepted = all.filter((f) => isAccepted(f.name));
    const rejected = all.length - accepted.length;
    if (rejected > 0) setSkipped((n) => n + rejected);
    if (accepted.length === 0) return;

    setQueuedFiles((current) => {
      const merged = [...current];
      for (const file of accepted) {
        merged.push({ id: makeQueueId(file), file });
      }
      return merged;
    });

    if (inputRef.current) inputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const files = await filesFromDataTransfer(e.dataTransfer);
    queueFiles(files);
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
    setSkipped(0);
  }

  async function uploadOne(
    item: QueueItem,
    resolvedAuditId: string,
  ): Promise<{ ok: boolean; replaced: boolean; error?: string }> {
    const form = new FormData();
    form.append('file', item.file);
    form.append('audit_id', resolvedAuditId);
    const selected = FILE_TYPE_OPTIONS.find((option) => option.value === fileType);
    if (selected?.areaCode) form.append('area_code', selected.areaCode);
    try {
      const res = await fetch('/api/files/evidence', { method: 'POST', body: form });
      const json = (await res.json()) as { ok?: boolean; error?: string; replaced?: string | null };
      if (res.ok && json.ok) return { ok: true, replaced: Boolean(json.replaced) };
      return { ok: false, replaced: false, error: json.error ?? 'Upload failed.' };
    } catch {
      return { ok: false, replaced: false, error: 'Network error — please try again.' };
    }
  }

  async function uploadQueuedFiles(items: QueueItem[]) {
    setBusy(true);
    setMessage(null);
    setProgress({ done: 0, total: items.length });

    let resolvedAuditId = auditId;
    if (!resolvedAuditId) {
      const started = await startClientAudit();
      if (!started.ok || !started.id) {
        setBusy(false);
        setProgress(null);
        setMessage({ tone: 'error', text: started.error ?? 'Could not start the audit.' });
        return;
      }
      resolvedAuditId = started.id;
      setAuditId(started.id);
    }
    const uploadAuditId: string = resolvedAuditId;

    let okCount = 0;
    let replacedCount = 0;
    let firstError: string | null = null;

    // Upload with a small concurrency pool so a whole folder finishes quickly
    // without opening hundreds of simultaneous requests.
    const POOL = 4;
    let index = 0;
    async function worker() {
      while (index < items.length) {
        const item = items[index++];
        const r = await uploadOne(item, uploadAuditId);
        if (r.ok) {
          okCount++;
          if (r.replaced) replacedCount++;
        } else if (!firstError) {
          firstError = r.error ?? 'Upload failed.';
        }
        setProgress({ done: okCount, total: items.length });
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL, items.length) }, worker));

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
    setProgress(null);
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

  function removeDuplicates() {
    const duplicateIds = Array.from(duplicateLookup.entries())
      .filter(([, value]) => value.duplicate)
      .map(([id]) => id);

    if (!duplicateIds.length) return;
    if (!window.confirm(`Remove ${duplicateIds.length} duplicate file${duplicateIds.length === 1 ? '' : 's'} from the queue?`)) return;

    setQueuedFiles((current) => current.filter((item) => !duplicateIds.includes(item.id)));
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

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => void handleDrop(e)}
        className={`rounded-none border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver
            ? 'border-[hsl(220,50%,40%)] bg-[hsl(220,50%,45%)]/10'
            : 'border-border/70 bg-muted/10'
        } ${busy ? 'opacity-60' : ''}`}
      >
        <UploadCloud size={26} className="mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium">
          Drag &amp; drop files or a whole folder here
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drop your evidence folder and we&apos;ll pull every supported file out of it — no need to
          add them one by one.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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
            Choose files
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

          <label
            className={`inline-flex items-center gap-2 rounded-none border border-border px-4 h-11 text-sm font-medium cursor-pointer transition-colors hover:bg-muted ${
              busy ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <FolderUp size={16} aria-hidden="true" />
            Select a folder
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // webkitdirectory lets the browser pick an entire folder tree.
              // React doesn't type these attributes, so cast on the props.
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              className="sr-only"
              disabled={busy}
              onChange={(e) => queueFiles(e.target.files)}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          PDF, Word, Excel, CSV or images · up to 25MB each · no queue limit
        </p>
        {skipped > 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            {skipped} unsupported file{skipped === 1 ? '' : 's'} skipped (only PDF, Word, Excel, CSV
            and images are accepted).
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Queued files</p>
          <div className="flex items-center gap-3">
            {duplicateCount > 0 ? (
              <button
                type="button"
                onClick={removeDuplicates}
                className="text-xs text-[hsl(220,45%,45%)] hover:text-foreground hover:underline"
                disabled={busy}
              >
                Remove duplicates
              </button>
            ) : null}
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
                  {duplicateLookup.get(item.id)?.duplicate ? (
                    <p className="mt-1 text-xs text-amber-700">
                      {duplicateLookup.get(item.id)?.inVault
                        ? 'Duplicate already in your vault.'
                        : 'Duplicate within this upload batch.'}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeQueuedFile(item.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-none border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  {duplicateLookup.get(item.id)?.duplicate ? 'Remove' : 'Delete'}
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
        {busy
          ? progress
            ? `Uploading ${progress.done}/${progress.total}…`
            : 'Uploading…'
          : `Upload ${queuedFiles.length || ''} file${queuedFiles.length === 1 ? '' : 's'}`.trim()}
      </button>
    </div>
  );
}
