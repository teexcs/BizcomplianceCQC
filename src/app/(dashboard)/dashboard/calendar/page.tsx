import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { getCalendarEvents } from '@/lib/data/client';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TYPE_STYLES: Record<string, string> = {
  deadline: 'bg-red-100 text-red-800',
  renewal: 'bg-amber-100 text-amber-800',
  review: 'bg-blue-100 text-blue-800',
  audit: 'bg-purple-100 text-purple-800',
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default async function CalendarPage() {
  const ctx = await requireOrgSession();
  const events = await getCalendarEvents(ctx.org.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Compliance calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statutory deadlines, review cycles and audit milestones for {ctx.org.name}.
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <CalendarDays className="mx-auto text-muted-foreground" size={40} aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No events scheduled yet. Review dates and statutory reminders are added by your
              auditor after your readiness audit.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ul className="divide-y">
              {events.map((e) => {
                const days = daysUntil(e.due_date);
                return (
                  <li key={e.id} className="py-4 flex flex-wrap items-start gap-4">
                    <div className="w-24 shrink-0 text-center rounded-md border bg-muted/40 px-2 py-2">
                      <p className="text-xs text-muted-foreground">
                        {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `In ${days}d`}
                      </p>
                      <p className="text-sm font-semibold tabular-nums mt-0.5">
                        {new Date(e.due_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.description ? (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {e.description}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(e.due_date)}</p>
                    </div>
                    <Badge className={TYPE_STYLES[e.event_type] ?? 'bg-muted text-foreground'}>
                      {e.event_type}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
