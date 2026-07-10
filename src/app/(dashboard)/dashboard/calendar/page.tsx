import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarComposer } from '@/components/dashboard/calendar-composer';
import { requireOrgSession } from '@/lib/data/session';
import { getCalendarEvents, getTasks } from '@/lib/data/client';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_STYLES: Record<string, string> = {
  deadline: 'bg-red-100 text-red-800',
  renewal: 'bg-amber-100 text-amber-800',
  review: 'bg-blue-100 text-blue-800',
  audit: 'bg-purple-100 text-purple-800',
  site_visit: 'bg-slate-100 text-slate-800',
  note: 'bg-slate-100 text-slate-800',
  task: 'bg-emerald-100 text-emerald-800',
  reminder: 'bg-orange-100 text-orange-800',
  follow_up: 'bg-teal-100 text-teal-800',
};

const TASK_STYLES: Record<string, string> = {
  admin: 'bg-slate-100 text-slate-800 border-slate-200',
  note: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  follow_up: 'bg-orange-100 text-orange-800 border-orange-200',
  'evidence-chase': 'bg-amber-100 text-amber-800 border-amber-200',
  'audit-overdue': 'bg-red-100 text-red-800 border-red-200',
  review: 'bg-blue-100 text-blue-800 border-blue-200',
  audit: 'bg-purple-100 text-purple-800 border-purple-200',
};

const SOURCE_LABELS: Record<string, string> = {
  client: 'You',
  manual: 'Admin',
  system: 'CQC',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseMonthKey(value?: string): Date {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return startOfMonth(new Date());
  const [year, month] = value.split('-').map(Number);
  return startOfMonth(new Date(year, month - 1, 1));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeekMonday(date: Date): Date {
  const next = new Date(date);
  const delta = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - delta);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(dateKeyValue: string): string {
  return new Date(`${dateKeyValue}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function taskLabel(kind: string): string {
  return kind
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; day?: string }>;
}) {
  const ctx = await requireOrgSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const month = parseMonthKey(resolvedSearchParams?.month);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(gridStart, 41);
  const [events, tasks] = await Promise.all([
    getCalendarEvents(ctx.org.id, { from: dateKey(gridStart), to: dateKey(gridEnd) }),
    getTasks(ctx.org.id, { from: dateKey(gridStart), to: dateKey(gridEnd) }),
  ]);
  const todayKey = dateKey(new Date());
  const fallbackDay = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
    .map((day) => dateKey(day))
    .find((key) => key >= dateKey(monthStart) && key <= dateKey(monthEnd)) ?? todayKey;
  const selectedDate =
    resolvedSearchParams?.day && /^\d{4}-\d{2}-\d{2}$/.test(resolvedSearchParams.day)
      ? resolvedSearchParams.day
      : todayKey >= dateKey(monthStart) && todayKey <= dateKey(monthEnd)
        ? todayKey
        : fallbackDay;

  const eventByDay = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventByDay.get(event.due_date) ?? [];
    list.push(event);
    eventByDay.set(event.due_date, list);
  }

  const taskByDay = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const list = taskByDay.get(task.due_date) ?? [];
    list.push(task);
    taskByDay.set(task.due_date, list);
  }

  const days = Array.from({ length: 42 }, (_, index) => {
    const current = addDays(gridStart, index);
    const key = dateKey(current);
    return {
      key,
      day: current.getDate(),
      inMonth: current.getMonth() === month.getMonth(),
      isToday: key === dateKey(new Date()),
    };
  });

  const selectedEvents = eventByDay.get(selectedDate) ?? [];
  const selectedTasks = taskByDay.get(selectedDate) ?? [];

  const prevMonthHref = `/dashboard/calendar?month=${monthKey(addMonths(monthStart, -1))}`;
  const nextMonthHref = `/dashboard/calendar?month=${monthKey(addMonths(monthStart, 1))}`;
  const todayHref = `/dashboard/calendar?month=${monthKey(new Date())}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Compliance calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Statutory deadlines, review cycles and audit milestones for {ctx.org.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={prevMonthHref}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
          <Link
            href={todayHref}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Today
          </Link>
          <Link
            href={nextMonthHref}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Calendar month
                </p>
                <h2 className="font-display text-xl tracking-tight">
                  {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <Badge variant="outline" className="shrink-0">
                <CalendarDays size={14} className="mr-1" aria-hidden="true" />
                {events.length + tasks.length} item{events.length + tasks.length === 1 ? '' : 's'}
              </Badge>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className={TYPE_STYLES.review}>Review</Badge>
              <Badge className={TYPE_STYLES.deadline}>Deadline</Badge>
              <Badge className={TYPE_STYLES.renewal}>Renewal</Badge>
              <Badge className={TYPE_STYLES.audit}>Audit</Badge>
              <Badge className={TYPE_STYLES.site_visit}>Site visit</Badge>
              <Badge className={TASK_STYLES.note}>Note</Badge>
              <Badge className={TASK_STYLES.follow_up}>Follow up</Badge>
            </div>

            <div className="grid grid-cols-7 border-l border-t border-border/70">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="border-b border-r border-border/70 bg-muted/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {day}
                </div>
              ))}

              {days.map((day) => {
                const dayEvents = eventByDay.get(day.key) ?? [];
                const dayTasks = taskByDay.get(day.key) ?? [];

                return (
                  <Link
                    key={day.key}
                    href={`/dashboard/calendar?month=${monthKey(monthStart)}&day=${day.key}`}
                    className={`min-h-32 border-b border-r border-border/70 p-3 text-left transition-colors ${
                      day.inMonth ? 'bg-background' : 'bg-muted/20 text-muted-foreground'
                    } ${
                      day.isToday || day.key === selectedDate
                        ? 'ring-1 ring-inset ring-[hsl(220,45%,55%)] bg-[hsl(220,50%,96%)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm tabular-nums ${
                          day.isToday ? 'font-bold text-[hsl(220,45%,15%)]' : 'font-medium'
                        }`}
                      >
                        {day.day}
                        {day.isToday ? <span className="sr-only">Today</span> : null}
                      </p>
                      {dayEvents.length + dayTasks.length ? (
                        <Badge variant="outline" className="shrink-0">
                          {dayEvents.length + dayTasks.length}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-md border px-2 py-1 ${TYPE_STYLES[event.event_type] ?? 'border-border/70 bg-muted/30 text-foreground'}`}
                        >
                          <p className="truncate text-xs font-medium">{event.title}</p>
                          <p className="text-[11px] opacity-80">
                            {event.event_type} · {sourceLabel(event.source)}
                          </p>
                        </div>
                      ))}
                      {dayTasks.slice(0, 2).map((task) => (
                        <div
                          key={task.id}
                          className={`rounded-md border border-dashed px-2 py-1 ${TASK_STYLES[task.kind] ?? 'border-border/70 bg-background text-foreground'}`}
                        >
                          <p className="truncate text-xs font-medium">{task.title}</p>
                          <p className="text-[11px] opacity-80">{taskLabel(task.kind)} · {task.priority}</p>
                        </div>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Selected day
                  </p>
                  <h2 className="font-display text-lg tracking-tight">
                    {dayLabel(selectedDate)}
                  </h2>
                </div>
                <Badge
                  className={
                    selectedDate === todayKey
                      ? 'bg-[hsl(220,45%,15%)] text-[hsl(36,33%,97%)]'
                      : 'bg-muted text-foreground'
                  }
                >
                  {selectedDate === todayKey ? 'Today' : 'Selected'}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {selectedEvents.length === 0 && selectedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items on this date. Your admin can add calendar events or tasks and they will
                    appear here when due.
                  </p>
                ) : (
                  <>
                    {selectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`rounded-xl border px-4 py-3 ${TYPE_STYLES[event.event_type] ?? 'border-border/70 bg-background text-foreground'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="mt-1 text-xs opacity-80">
                              Event · {event.event_type} · {formatDate(event.due_date)}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Badge className={TYPE_STYLES[event.event_type] ?? 'bg-muted text-foreground'}>
                              {event.event_type}
                            </Badge>
                            <Badge variant="outline">{sourceLabel(event.source)}</Badge>
                          </div>
                        </div>
                        {event.description ? (
                          <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
                        ) : null}
                      </div>
                    ))}
                    {selectedTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`rounded-xl border border-dashed px-4 py-3 ${TASK_STYLES[task.kind] ?? 'border-border/70 bg-background text-foreground'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="mt-1 text-xs opacity-80">
                              Task · {taskLabel(task.kind)} · {task.priority}
                          </p>
                        </div>
                        <Badge className={TASK_STYLES[task.kind] ?? 'bg-muted text-foreground'}>
                            {taskLabel(task.kind)}
                          </Badge>
                        </div>
                        {task.detail ? (
                          <p className="mt-2 text-sm text-muted-foreground">{task.detail}</p>
                        ) : null}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <CalendarComposer selectedDate={selectedDate} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Calendar rule</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This calendar shows what your auditor sets for you, including deadlines, reviews and
                follow-up tasks. Open this page to see what is due today and what is coming next.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
