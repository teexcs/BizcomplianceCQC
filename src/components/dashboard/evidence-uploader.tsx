'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface AreaOption {
  code: string;
  name: string;
}

const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp';

export function EvidenceUploader({ areas }: { areas: AreaOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [areaCode, setAreaCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage(null);

    let okCount = 0;
    let firstError: string | null = null;
    for (const file of Array.from(files).slice(0, 10)) {
      const form = new FormData();
      form.append('file', file);
      if (areaCode) form.append('area_code', areaCode);
      try {
        const res = await fetch('/api/files/evidence', { method: 'POST', body: form });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (res.ok && json.ok) okCount++;
        else if (!firstError) firstError = json.error ?? 'Upload failed.';
      } catch {
        if (!firstError) firstError = 'Network error — please try again.';
      }
    }

    if (okCount > 0) {
      setMessage({
        tone: 'ok',
        text: `${okCount} file${okCount === 1 ? '' : 's'} uploaded to your vault.`,
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

  return (
    <div className="space-y-4">
      <div className="grid gap-2 max-w-sm">
        <Label htmlFor="evidence-area">Compliance area (optional)</Label>
        <Select
          id="evidence-area"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
        >
          <option value="">Unsorted — let your auditor file it</option>
          {areas.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
      </div>

      <label
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer ${
          busy ? 'opacity-60 pointer-events-none' : 'hover:border-[hsl(220,45%,45%)] hover:bg-muted/40'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void uploadFiles(e.dataTransfer.files);
        }}
      >
        {busy ? (
          <Loader2 className="animate-spin text-muted-foreground" size={32} aria-hidden="true" />
        ) : (
          <UploadCloud className="text-muted-foreground" size={32} aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-medium">
            {busy ? 'Uploading…' : 'Drop files here or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Word, Excel, CSV or images · up to 25MB each · max 10 at a time
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => void uploadFiles(e.target.files)}
        />
      </label>

      {message ? (
        <p
          role="status"
          className={`text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
