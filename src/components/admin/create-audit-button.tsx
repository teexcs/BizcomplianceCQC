'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createAuditManually } from '@/lib/actions/admin';

interface OrgOption {
  id: string;
  name: string;
}

export function CreateAuditButton({ organisations }: { organisations: OrgOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [kind, setKind] = useState<'one_off' | 're_audit'>('one_off');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const result = await createAuditManually(orgId, kind);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not create the audit.');
      return;
    }
    setOpen(false);
    if (result.id) router.push(`/admin/audits/${result.id}`);
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[hsl(220,45%,55%)] to-[hsl(220,50%,38%)] text-[#111722] px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity"
      >
        <Plus size={16} aria-hidden="true" /> Start new audit
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 z-20 w-80 rounded-xl border border-border bg-card p-4 shadow-xl space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-audit-org">Client</Label>
            <Select id="new-audit-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Select a client</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-audit-kind">Type</Label>
            <Select
              id="new-audit-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'one_off' | 're_audit')}
            >
              <option value="one_off">One-off audit (offline payment)</option>
              <option value="re_audit">Re-audit (plan benefit)</option>
            </Select>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !orgId}
              onClick={handleCreate}
              className="flex-1 rounded-md bg-primary text-primary-foreground text-sm font-medium py-2 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create audit'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-3 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Snapshots all 139 checklist items, 18 areas and 68 SAF questions for this client.
          </p>
        </div>
      ) : null}
    </div>
  );
}
