import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { getRequests } from '@/lib/data/client';
import { RequestForm } from '@/components/dashboard/request-form';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_review: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  closed: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_review: 'In review',
  delivered: 'Delivered',
  closed: 'Closed',
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'text-red-700',
  medium: 'text-amber-700',
  low: 'text-muted-foreground',
};

export default async function RequestsPage() {
  const ctx = await requireOrgSession();
  const requests = await getRequests(ctx.org.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask for document updates, evidence reviews or compliance guidance. Requests are handled
          under your plan&apos;s response time.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-display text-lg tracking-tight mb-4">New request</h2>
          <RequestForm />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg tracking-tight">Request history</h2>
            <span className="text-xs text-muted-foreground">{requests.length} total</span>
          </div>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No requests yet — your history appears here.
            </p>
          ) : (
            <ul className="divide-y">
              {requests.map((r) => (
                <li key={r.id} className="py-4 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium flex-1 min-w-0">{r.type}</p>
                    <span className={`text-xs font-medium ${PRIORITY_STYLES[r.priority]}`}>
                      {r.priority} priority
                    </span>
                    <Badge className={STATUS_STYLES[r.status] ?? ''}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>
                  <p className="text-xs text-muted-foreground">Submitted {formatDate(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
