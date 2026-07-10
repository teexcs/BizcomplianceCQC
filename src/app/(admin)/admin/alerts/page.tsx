import { getAllAlerts } from '@/lib/data/admin';
import { AlertComposer } from '@/components/admin/alert-composer';
import { AlertReviewBoard } from '@/components/admin/alert-review-board';

export const dynamic = 'force-dynamic';

export default async function AdminAlertsPage() {
  const alerts = await getAllAlerts();
  const pending = alerts.filter((alert) => !alert.published).length;
  const published = alerts.filter((alert) => alert.published).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Regulatory alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review CQC updates here first, then publish the ones you want clients to see.
        </p>
      </div>

      <AlertComposer />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending review</div>
          <div className="mt-2 text-3xl font-display">{pending}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Live on client dashboards</div>
          <div className="mt-2 text-3xl font-display">{published}</div>
        </div>
      </section>

      <AlertReviewBoard alerts={alerts} />
    </div>
  );
}
