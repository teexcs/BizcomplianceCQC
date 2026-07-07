import { Card, CardContent } from '@/components/ui/card';
import { requireOrgSession } from '@/lib/data/session';
import { getAlerts } from '@/lib/data/client';
import { AlertList } from '@/components/dashboard/alert-list';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const ctx = await requireOrgSession();
  const alerts = await getAlerts(ctx.userId);
  const unread = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Regulatory alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CQC and sector updates relevant to your service.
          {unread > 0 ? ` ${unread} unread.` : ''}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AlertList
            alerts={alerts.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              category: a.category,
              external_url: a.external_url,
              published_at: a.published_at,
              isRead: a.isRead,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
