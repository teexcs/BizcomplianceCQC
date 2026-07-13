'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Pencil, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import {
  deleteAlert,
  publishAlert,
  upsertAlert,
  pushAlertToCalendars,
  runAlertsSyncNow,
} from '@/lib/actions/admin';
import type { Alert } from '@/types/database';

type AlertReviewBoardProps = {
  alerts: Alert[];
};

function kindLabel(kind: string): string {
  if (kind === 'manual') return 'Manual';
  return kind
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function AlertRow({ alert, primaryLabel }: { alert: Alert; primaryLabel: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [mode, setMode] = useState<'view' | 'edit' | 'push'>('view');
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: alert.title,
    body: alert.body,
    category: alert.category,
    external_url: alert.external_url ?? '',
    legislative: alert.legislative,
  });
  const [push, setPush] = useState({
    scope: 'global' as 'global' | 'per_client',
    title: alert.title,
    description: '',
    due_date: todayPlusDays(30),
  });

  const publishedLabel = alert.published_at ? formatDate(alert.published_at) : formatDate(alert.created_at);
  const sourceLabel = alert.source_kind === 'manual' ? 'Manual alert' : `${kindLabel(alert.source_kind)} review`;
  const statusLabel = alert.published ? 'Published' : 'Awaiting approval';

  function doPublish() {
    startTransition(async () => {
      const r = await publishAlert(alert.id);
      if (r.ok) router.refresh();
    });
  }
  function doUnpublish() {
    startTransition(async () => {
      const r = await upsertAlert({ ...form, id: alert.id, published: false });
      if (r.ok) router.refresh();
    });
  }
  function doDelete() {
    if (!window.confirm(`Delete "${alert.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteAlert(alert.id);
      if (r.ok) router.refresh();
    });
  }
  function saveEdit() {
    setMsg(null);
    startTransition(async () => {
      const r = await upsertAlert({ ...form, id: alert.id, published: alert.published });
      if (r.ok) {
        setMode('view');
        router.refresh();
      } else setMsg(r.error ?? 'Could not save.');
    });
  }
  function doPush() {
    setMsg(null);
    startTransition(async () => {
      const r = await pushAlertToCalendars({ alertId: alert.id, ...push });
      if (r.ok) {
        setMsg(`Pushed to ${r.pushed} calendar${r.pushed === 1 ? '' : 's'}.`);
        setMode('view');
        router.refresh();
      } else setMsg(r.error ?? 'Could not push.');
    });
  }

  return (
    <Card className="border-border/70">
      <CardContent className="py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{kindLabel(alert.category)}</Badge>
              <Badge variant={alert.published ? 'default' : 'secondary'}>{statusLabel}</Badge>
              <Badge variant="outline">{sourceLabel}</Badge>
              {alert.legislative ? (
                <Badge className="bg-amber-500/15 text-amber-700">Legislation</Badge>
              ) : null}
            </div>
            <h3 className="text-sm font-semibold leading-6 text-foreground">{alert.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{alert.body}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Source date: {publishedLabel}</span>
              {alert.external_url ? (
                <a href={alert.external_url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                  Open source
                </a>
              ) : null}
              {alert.approved_at ? <span>Approved: {formatDate(alert.approved_at)}</span> : null}
            </div>
            {msg ? <p className="text-xs text-green-700">{msg}</p> : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {!alert.published ? (
              <Button type="button" onClick={doPublish} disabled={busy}>
                {primaryLabel}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={doUnpublish} disabled={busy}>
                Unpublish
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')} disabled={busy}>
              <Pencil size={14} className="mr-1" /> Edit
            </Button>
            <Button type="button" variant="outline" onClick={() => setMode(mode === 'push' ? 'view' : 'push')} disabled={busy}>
              <CalendarPlus size={14} className="mr-1" /> Push to calendar
            </Button>
            <Button type="button" variant="outline" onClick={doDelete} disabled={busy}>
              Remove
            </Button>
          </div>
        </div>

        {mode === 'edit' ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`t-${alert.id}`}>Title</Label>
                <Input id={`t-${alert.id}`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`c-${alert.id}`}>Category</Label>
                <Select id={`c-${alert.id}`} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="safe">Safe</option>
                  <option value="effective">Effective</option>
                  <option value="caring">Caring</option>
                  <option value="responsive">Responsive</option>
                  <option value="well-led">Well-led</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`b-${alert.id}`}>Body</Label>
              <Textarea id={`b-${alert.id}`} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className="min-h-[80px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`u-${alert.id}`}>Source URL</Label>
              <Input id={`u-${alert.id}`} value={form.external_url} onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))} placeholder="https://…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.legislative} onChange={(e) => setForm((f) => ({ ...f, legislative: e.target.checked }))} />
              Involves law / legislation (eligible to push to calendars)
            </label>
            <div className="flex gap-2">
              <Button type="button" onClick={saveEdit} disabled={busy}>Save changes</Button>
              <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {mode === 'push' ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">
              Add this as a dated action on client calendars. Choose whether everyone sees one shared
              event, or each client gets their own.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`ps-${alert.id}`}>Who gets it</Label>
                <Select id={`ps-${alert.id}`} value={push.scope} onChange={(e) => setPush((p) => ({ ...p, scope: e.target.value as 'global' | 'per_client' }))}>
                  <option value="global">All clients — one shared event</option>
                  <option value="per_client">Each client — their own event</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pd-${alert.id}`}>Due by</Label>
                <Input id={`pd-${alert.id}`} type="date" value={push.due_date} onChange={(e) => setPush((p) => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pt-${alert.id}`}>Event title</Label>
              <Input id={`pt-${alert.id}`} value={push.title} onChange={(e) => setPush((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pdesc-${alert.id}`}>What clients need to do (optional)</Label>
              <Textarea id={`pdesc-${alert.id}`} value={push.description} onChange={(e) => setPush((p) => ({ ...p, description: e.target.value }))} className="min-h-[64px]" placeholder="e.g. Review your safeguarding policy against the new guidance and record the update." />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={doPush} disabled={busy}>Push to calendars</Button>
              <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AlertReviewBoard({ alerts }: AlertReviewBoardProps) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const { pending, published } = useMemo(
    () => ({
      pending: alerts.filter((alert) => !alert.published),
      published: alerts.filter((alert) => alert.published),
    }),
    [alerts],
  );

  function fetchNow() {
    setSyncMsg(null);
    startSync(async () => {
      const r = await runAlertsSyncNow();
      setSyncMsg(r.ok ? `Fetched updates — ${r.staged ?? 0} new item(s) staged for review.` : r.error ?? 'Fetch failed.');
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">Regulatory feed</p>
          <p className="text-xs text-muted-foreground">
            Pulls CQC, GOV.UK, NICE, Skills for Care, SCIE, legislation and care-sector press.
            {syncMsg ? <span className="ml-1 text-green-700">{syncMsg}</span> : null}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={fetchNow} disabled={syncing}>
          <RefreshCw size={14} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Fetching…' : 'Fetch updates now'}
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">Pending review</h2>
            <p className="text-sm text-muted-foreground">
              New items stay here until you approve them for client alerts.
            </p>
          </div>
          <Badge variant="outline">{pending.length} waiting</Badge>
        </div>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Nothing is waiting for approval.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((alert) => (
              <AlertRow key={alert.id} alert={alert} primaryLabel="Publish to clients" />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">Published alerts</h2>
            <p className="text-sm text-muted-foreground">These are live on the client dashboard.</p>
          </div>
          <Badge variant="outline">{published.length} live</Badge>
        </div>

        {published.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Nothing is live yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {published.map((alert) => (
              <AlertRow key={alert.id} alert={alert} primaryLabel="Publish to clients" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
