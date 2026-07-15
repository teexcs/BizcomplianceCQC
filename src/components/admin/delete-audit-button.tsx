'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteAudit } from '@/lib/actions/admin';

interface DeleteAuditButtonProps {
  auditId: string;
  organisationName: string;
  disabled?: boolean;
}

export function DeleteAuditButton({
  auditId,
  organisationName,
  disabled = false,
}: DeleteAuditButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          const confirmed = window.confirm(
            `Delete this audit for ${organisationName}? This removes the audit checklist, findings, samples and draft reports. Uploaded evidence stays in the vault.`,
          );
          if (!confirmed) return;
          startTransition(async () => {
            const result = await deleteAudit(auditId);
            if (!result.ok) {
              setError(result.error ?? 'Could not delete the audit.');
              return;
            }
            router.push('/admin/audits');
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={14} aria-hidden="true" /> {pending ? 'Deleting...' : 'Delete trial audit'}
      </button>
      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
