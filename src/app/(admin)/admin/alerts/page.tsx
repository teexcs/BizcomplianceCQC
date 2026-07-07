import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAllAlerts } from '@/lib/data/admin';
import { AlertComposer } from '@/components/admin/alert-composer';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminAlertsPage() {
  const alerts = await getAllAlerts();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Regulatory alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publish CQC and sector updates to every client dashboard.
        </p>
      </div>

      <AlertComposer />

      <section>
        <h2 className="font-display text-lg tracking-tight mb-3">
          Published & drafts{' '}
          <span className="text-sm text-muted-foreground font-sans">({alerts.length})</span>
        </h2>
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No alerts yet — publish your first regulatory digest above.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {alerts.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium flex-1 min-w-0">{a.title}</p>
                    <Badge variant="outline">{a.category}</Badge>
                    {a.published ? (
                      <Badge className="bg-green-500/15 text-green-300">Published</Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-300">Draft</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(a.published_at ?? a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
