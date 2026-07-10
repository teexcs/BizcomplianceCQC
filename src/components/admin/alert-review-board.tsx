'use client';

import { useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { deleteAlert, publishAlert } from '@/lib/actions/admin';
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

function AlertRow({
  alert,
  primaryLabel,
}: {
  alert: Alert;
  primaryLabel: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const publishedLabel = alert.published_at ? formatDate(alert.published_at) : formatDate(alert.created_at);
  const sourceLabel = alert.source_kind === 'manual' ? 'Manual alert' : `${kindLabel(alert.source_kind)} review`;
  const statusLabel = alert.published ? 'Published' : 'Awaiting approval';

  function doPublish() {
    startTransition(async () => {
      const result = await publishAlert(alert.id);
      if (result.ok) router.refresh();
    });
  }

  function doDelete() {
    if (!window.confirm(`Delete "${alert.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteAlert(alert.id);
      if (result.ok) router.refresh();
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
            </div>
            <h3 className="text-sm font-semibold leading-6 text-foreground">{alert.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{alert.body}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Source date: {publishedLabel}</span>
              {alert.external_url ? (
                <a
                  href={alert.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open source
                </a>
              ) : null}
              {alert.approved_at ? <span>Approved: {formatDate(alert.approved_at)}</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {!alert.published ? (
              <Button type="button" onClick={doPublish} disabled={busy}>
                {primaryLabel}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={doDelete} disabled={busy}>
              Remove
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AlertReviewBoard({ alerts }: AlertReviewBoardProps) {
  const { pending, published } = useMemo(
    () => ({
      pending: alerts.filter((alert) => !alert.published),
      published: alerts.filter((alert) => alert.published),
    }),
    [alerts],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">Pending review</h2>
            <p className="text-sm text-muted-foreground">
              New CQC items stay here until you approve them for client alerts.
            </p>
          </div>
          <Badge variant="outline">{pending.length} waiting</Badge>
        </div>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Nothing is waiting for approval.
            </CardContent>
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
            <p className="text-sm text-muted-foreground">
              These are live on the client dashboard.
            </p>
          </div>
          <Badge variant="outline">{published.length} live</Badge>
        </div>

        {published.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Nothing is live yet.
            </CardContent>
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
