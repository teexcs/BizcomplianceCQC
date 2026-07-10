'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createCalendarEvent, createTask } from '@/lib/actions/admin';
import { formatDate } from '@/lib/utils';
import type { CalendarEvent, Task } from '@/types/database';

type CalendarMonthProps = {
  monthKey: string;
  organisations: Array<{ id: string; name: string; planLabel: string; siteVisitPerQuarter: number }>;
  days: Array<{
    key: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
  }>;
  events: CalendarEvent[];
  tasks: Task[];
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseMonthKey(value: string): Date {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
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

function formatDayLabel(dateKeyValue: string): string {
  return new Date(`${dateKeyValue}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const EVENT_STYLES: Record<string, string> = {
  deadline: 'bg-red-100 text-red-800 border-red-200',
  renewal: 'bg-amber-100 text-amber-800 border-amber-200',
  review: 'bg-blue-100 text-blue-800 border-blue-200',
  audit: 'bg-purple-100 text-purple-800 border-purple-200',
  site_visit: 'bg-slate-100 text-slate-800 border-slate-200',
  note: 'bg-slate-100 text-slate-800 border-slate-200',
  task: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  reminder: 'bg-orange-100 text-orange-800 border-orange-200',
  follow_up: 'bg-teal-100 text-teal-800 border-teal-200',
};

const TASK_STYLES: Record<string, string> = {
  admin: 'bg-slate-100 text-slate-800 border-slate-200',
  note: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  follow_up: 'bg-orange-100 text-orange-800 border-orange-200',
};

const SOURCE_LABELS: Record<string, string> = {
  client: 'Client',
  manual: 'Admin',
  system: 'System',
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function AdminCalendarWorkbench({
  monthKey: initialMonthKey,
  organisations,
  days,
  events,
  tasks,
}: CalendarMonthProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = dateKey(new Date());
    return days.some((day) => day.key === today) ? today : days.find((day) => day.inMonth)?.key ?? days[0].key;
  });
  const [busy, startTransition] = useTransition();
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'review',
    org_id: '',
  });
  const [taskForm, setTaskForm] = useState({
    title: '',
    detail: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    kind: 'admin',
    org_id: '',
  });

  const selectedEvents = useMemo(
    () => events.filter((event) => event.due_date === selectedDate),
    [events, selectedDate],
  );
  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.due_date === selectedDate),
    [tasks, selectedDate],
  );
  const selectedDateLabel = formatDayLabel(selectedDate);
  const selectedIsToday = selectedDate === dateKey(new Date());
  const monthStart = parseMonthKey(initialMonthKey);
  const prevMonthHref = `/admin/calendar?month=${monthKey(addMonths(monthStart, -1))}`;
  const nextMonthHref = `/admin/calendar?month=${monthKey(addMonths(monthStart, 1))}`;
  const todayHref = `/admin/calendar?month=${monthKey(new Date())}`;
  const selectedOrg = organisations.find((org) => org.id === eventForm.org_id) ?? null;
  const selectedOrgLimit = selectedOrg?.siteVisitPerQuarter ?? 0;

  async function submitEvent() {
    startTransition(async () => {
      const result = await createCalendarEvent({
        org_id: eventForm.org_id.trim() ? eventForm.org_id.trim() : null,
        title: eventForm.title,
        description: eventForm.description,
        event_type: eventForm.event_type,
        due_date: selectedDate,
      });
      if (!result.ok) return;
      setEventForm({ title: '', description: '', event_type: 'review', org_id: '' });
      router.refresh();
    });
  }

  async function submitTask() {
    startTransition(async () => {
      const result = await createTask({
        title: taskForm.title,
        detail: taskForm.detail,
        kind: taskForm.kind,
        priority: taskForm.priority,
        due_date: selectedDate,
        org_id: taskForm.org_id.trim() ? taskForm.org_id.trim() : null,
      });
      if (!result.ok) return;
      setTaskForm({ title: '', detail: '', priority: 'medium', kind: 'admin', org_id: '' });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Admin calendar
              </p>
              <h2 className="font-display text-xl tracking-tight">
                {new Date(`${initialMonthKey}-01T00:00:00`).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={prevMonthHref}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </a>
              <a
                href={todayHref}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Today
              </a>
              <a
                href={nextMonthHref}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                aria-label="Next month"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className={EVENT_STYLES.review}>Review</Badge>
            <Badge className={EVENT_STYLES.deadline}>Deadline</Badge>
            <Badge className={EVENT_STYLES.renewal}>Renewal</Badge>
            <Badge className={EVENT_STYLES.audit}>Audit</Badge>
            <Badge className={EVENT_STYLES.site_visit}>Site visit</Badge>
            <Badge className={TASK_STYLES.note}>Note</Badge>
            <Badge className={TASK_STYLES.follow_up}>Follow up</Badge>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-border/70">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="border-b border-r border-border/70 bg-muted/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {days.map((day) => {
              const key = day.key;
              const dayEvents = events.filter((event) => event.due_date === key);
              const dayTasks = tasks.filter((task) => task.due_date === key);
              const isSelected = key === selectedDate;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={`min-h-32 border-b border-r border-border/70 p-3 text-left transition-colors ${
                    day.inMonth ? 'bg-background' : 'bg-muted/20 text-muted-foreground'
                  } ${isSelected ? 'bg-[hsl(220,50%,96%)] ring-1 ring-inset ring-[hsl(220,45%,55%)]' : ''}`}
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
                    {dayEvents.length || dayTasks.length ? (
                      <Badge variant="outline" className="shrink-0">
                        {dayEvents.length + dayTasks.length}
                      </Badge>
                    ) : null}
                  </div>

                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-md border px-2 py-1 ${EVENT_STYLES[event.event_type] ?? 'border-border/70 bg-muted/30 text-foreground'}`}
                        >
                          <p className="truncate text-xs font-medium">{event.title}</p>
                          <p className="text-[11px] opacity-80">
                            {event.event_type} · {sourceLabel(event.source)}
                          </p>
                        </div>
                      ))}
                      {dayTasks.slice(0, 1).map((task) => (
                        <div
                          key={task.id}
                          className={`rounded-md border border-dashed px-2 py-1 ${TASK_STYLES[task.kind] ?? 'border-border/70 bg-background text-foreground'}`}
                        >
                          <p className="truncate text-xs font-medium">{task.title}</p>
                          <p className="text-[11px] opacity-80">{task.kind} · {task.priority}</p>
                        </div>
                      ))}
                    </div>
                </button>
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
                <h2 className="font-display text-lg tracking-tight">{selectedDateLabel}</h2>
                {selectedIsToday ? (
                  <Badge className="mt-2 bg-[hsl(220,45%,15%)] text-[hsl(36,33%,97%)]">Today</Badge>
                ) : null}
              </div>
              <Badge variant="outline" className="shrink-0">
                <CalendarDays size={14} className="mr-1" aria-hidden="true" />
                {selectedEvents.length + selectedTasks.length} items
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              {selectedEvents.length === 0 && selectedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No items on this date yet. Use the box below to add a note, task or calendar event.
                </p>
              ) : (
                <>
                    {selectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`rounded-xl border px-4 py-3 ${EVENT_STYLES[event.event_type] ?? 'border-border/70 bg-background text-foreground'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="mt-1 text-xs opacity-80">
                              Event · {event.event_type} · {formatDate(event.due_date)}
                            </p>
                          </div>
                          <Badge variant="outline">{sourceLabel(event.source)}</Badge>
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
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="mt-1 text-xs opacity-80">
                        Task · {task.kind} · {task.priority}
                      </p>
                      {task.detail ? <p className="mt-2 text-sm text-muted-foreground">{task.detail}</p> : null}
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Write stuff
                </p>
                <h3 className="font-display text-lg tracking-tight">Add a calendar item</h3>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-org">Calendar target</Label>
                  <Select
                    id="event-org"
                    value={eventForm.org_id}
                    onChange={(e) => setEventForm((f) => ({ ...f, org_id: e.target.value }))}
                  >
                    <option value="">Global reminder</option>
                    {organisations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                      ))}
                  </Select>
                  {selectedOrg ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedOrg.planLabel} · {selectedOrgLimit} site visit
                      {selectedOrgLimit === 1 ? '' : 's'} per quarter
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    value={eventForm.title}
                    onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Review care plan evidence"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-description">Notes</Label>
                  <Textarea
                    id="event-description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Add context, follow-up actions or reminders."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-type">Type</Label>
                  <Select
                    id="event-type"
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))}
                  >
                    <option value="review">Review</option>
                    <option value="deadline">Deadline</option>
                    <option value="renewal">Renewal</option>
                    <option value="audit">Audit</option>
                    <option value="site_visit">Site visit</option>
                  </Select>
                </div>
                {eventForm.event_type === 'site_visit' ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedOrg
                      ? `${selectedOrg.planLabel} allows ${selectedOrgLimit} site visit${selectedOrgLimit === 1 ? '' : 's'} per quarter.`
                      : 'Choose a client first so the site-visit limit can be checked.'}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={
                  busy ||
                  eventForm.title.trim().length < 3 ||
                  (eventForm.event_type === 'site_visit' && (!selectedOrg || selectedOrgLimit <= 0))
                }
                onClick={submitEvent}
                className="inline-flex items-center gap-2 rounded-md bg-[hsl(220,50%,15%)] px-4 py-2.5 text-sm font-medium text-[hsl(36,33%,97%)] transition-colors hover:bg-[hsl(220,50%,20%)] disabled:opacity-50"
              >
                <Plus size={15} aria-hidden="true" />
                Add event to {selectedDate}
              </button>
            </div>

            <div className="space-y-3 border-t border-border/70 pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Set tasks
                </p>
                <h3 className="font-display text-lg tracking-tight">Add a task or note</h3>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="task-title">Title</Label>
                  <Input
                    id="task-title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Call Oakfield about missing policies"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-detail">Details</Label>
                  <Textarea
                    id="task-detail"
                    value={taskForm.detail}
                    onChange={(e) => setTaskForm((f) => ({ ...f, detail: e.target.value }))}
                    placeholder="Add a short note for yourself or your team."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="task-org">Task target</Label>
                    <Select
                      id="task-org"
                      value={taskForm.org_id}
                      onChange={(e) => setTaskForm((f) => ({ ...f, org_id: e.target.value }))}
                    >
                      <option value="">Global task</option>
                      {organisations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-kind">Kind</Label>
                    <Select
                      id="task-kind"
                      value={taskForm.kind}
                      onChange={(e) => setTaskForm((f) => ({ ...f, kind: e.target.value }))}
                    >
                      <option value="admin">Task</option>
                      <option value="note">Note</option>
                      <option value="follow_up">Follow up</option>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select
                    id="task-priority"
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm((f) => ({
                        ...f,
                        priority: e.target.value as 'low' | 'medium' | 'high',
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </div>
              </div>

              <button
                type="button"
                disabled={busy || taskForm.title.trim().length < 3}
                onClick={submitTask}
                className="inline-flex items-center gap-2 rounded-md border border-[hsl(220,50%,15%)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Plus size={15} aria-hidden="true" />
                Add task for {selectedDate}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
