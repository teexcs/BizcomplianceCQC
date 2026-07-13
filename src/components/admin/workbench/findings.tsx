'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { upsertFinding, deleteFinding, resolveFinding } from '@/lib/actions/admin';
import { FINDING_PRIORITY_LABELS } from '@/lib/audit/scoring';
import { FindingsPicker, type PickedFinding } from './findings-picker';
import type { AuditFinding, LibraryArea } from '@/types/database';

const SEVERITY_STYLES: Record<string, string> = {
  red: 'bg-red-500/15 text-red-300',
  amber: 'bg-amber-500/15 text-amber-300',
  green: 'bg-green-500/15 text-green-300',
};

interface Props {
  findings: AuditFinding[];
  libraryAreas: LibraryArea[];
  auditId: string;
}

const EMPTY_FORM = {
  area_code: '',
  severity: 'amber' as 'red' | 'amber' | 'green',
  title: '',
  detail: '',
  recommendation: '',
  priority: 'days_14' as 'fix_first' | 'days_7' | 'days_14' | 'days_30',
};

export function Findings({ findings, libraryAreas, auditId }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const areaName = new Map(libraryAreas.map((a) => [a.code, a.name]));
  const open = findings.filter((f) => f.status === 'open');
  const resolved = findings.filter((f) => f.status === 'resolved');

  function startEdit(f: AuditFinding) {
    setEditingId(f.id);
    setForm({
      area_code: f.area_code ?? '',
      severity: (f.severity === 'unset' ? 'amber' : f.severity) as 'red' | 'amber' | 'green',
      title: f.title,
      detail: f.detail ?? '',
      recommendation: f.recommendation ?? '',
      priority: f.priority,
    });
    setShowForm(true);
  }

  function applyPicked(p: PickedFinding) {
    setForm({
      area_code: p.area_code,
      severity: p.severity,
      title: p.title,
      detail: p.detail,
      recommendation: p.recommendation,
      priority: p.priority,
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await upsertFinding({
        id: editingId ?? undefined,
        auditId,
        area_code: form.area_code || null,
        severity: form.severity,
        title: form.title,
        detail: form.detail || null,
        recommendation: form.recommendation || null,
        priority: form.priority,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not save.');
        return;
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Findings become the client&apos;s priority action plan in the report.
        </p>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY_FORM);
            setShowForm((s) => !s);
          }}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Plus size={14} aria-hidden="true" /> {showForm ? 'Close' : 'Add finding'}
        </button>
      </div>

      {showForm ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <FindingsPicker onPick={applyPicked} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="finding-title">Title</Label>
              <Input
                id="finding-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. DBS risk assessments missing for 2 staff files"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finding-area">Compliance area</Label>
              <Select
                id="finding-area"
                value={form.area_code}
                onChange={(e) => setForm((f) => ({ ...f, area_code: e.target.value }))}
              >
                <option value="">Whole service</option>
                {libraryAreas.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finding-severity">Severity</Label>
              <Select
                id="finding-severity"
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, severity: e.target.value as typeof form.severity }))
                }
              >
                <option value="red">Red — critical breach risk</option>
                <option value="amber">Amber — needs improvement</option>
                <option value="green">Green — maintain</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finding-priority">Action window</Label>
              <Select
                id="finding-priority"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))
                }
              >
                <option value="fix_first">Fix first</option>
                <option value="days_7">7 days</option>
                <option value="days_14">14 days</option>
                <option value="days_30">30 days</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finding-detail">Detail</Label>
            <Textarea
              id="finding-detail"
              rows={2}
              value={form.detail}
              onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="What was found, and where."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finding-rec">Recommendation</Label>
            <Textarea
              id="finding-rec"
              rows={2}
              value={form.recommendation}
              onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
              placeholder="The practical step the provider should take."
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || form.title.length < 3}
            onClick={submit}
            className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Saving…' : editingId ? 'Update finding' : 'Add finding'}
          </button>
        </div>
      ) : null}

      {open.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No findings yet — add them as you work through the checklist and SAF interview.
        </p>
      ) : (
        <ul className="space-y-3">
          {open.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn(SEVERITY_STYLES[f.severity])}>{f.severity.toUpperCase()}</Badge>
                <p className="flex-1 min-w-0 text-sm font-medium">{f.title}</p>
                <Badge variant="outline">{FINDING_PRIORITY_LABELS[f.priority]}</Badge>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(f)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await resolveFinding(f.id, auditId);
                        router.refresh();
                      })
                    }
                    aria-label={`Resolve ${f.title}`}
                    className="text-green-400 hover:text-green-300 px-1.5"
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteFinding(f.id, auditId);
                        router.refresh();
                      })
                    }
                    aria-label={`Delete ${f.title}`}
                    className="text-muted-foreground hover:text-red-400 px-1.5"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {f.area_code ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.area_code} {areaName.get(f.area_code) ?? ''}
                </p>
              ) : null}
              {f.detail ? <p className="mt-1.5 text-sm text-muted-foreground">{f.detail}</p> : null}
              {f.recommendation ? (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Recommendation:</span> {f.recommendation}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Resolved findings ({resolved.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {resolved.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-3"
              >
                <CheckCircle2 size={14} className="text-green-500 shrink-0" aria-hidden="true" />
                {f.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
