import { requireAdminSession } from '@/lib/data/session';
import {
  getCalendarEvents,
  getOrganisationsForCalendar,
  getTasks,
} from '@/lib/data/admin';
import { AdminCalendarWorkbench } from '@/components/admin/calendar-workbench';

export const dynamic = 'force-dynamic';

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

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  await requireAdminSession();
  const resolved = searchParams ? await searchParams : undefined;
  const month = parseMonthKey(resolved?.month);
  const monthStart = startOfMonth(month);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(gridStart, 41);

  const [events, tasks] = await Promise.all([
    getCalendarEvents(),
    getTasks(),
  ]);
  const organisations = await getOrganisationsForCalendar();

  const monthEvents = events.filter((event) => event.due_date >= dateKey(gridStart) && event.due_date <= dateKey(gridEnd));
  const monthTasks = tasks.filter((task) => task.due_date && task.due_date >= dateKey(gridStart) && task.due_date <= dateKey(gridEnd));

  const days = Array.from({ length: 42 }, (_, index) => {
    const current = addDays(gridStart, index);
    return {
      key: dateKey(current),
      day: current.getDate(),
      inMonth: current.getMonth() === month.getMonth(),
      isToday: dateKey(current) === dateKey(new Date()),
    };
  });

  return (
    <AdminCalendarWorkbench
      monthKey={monthKey(monthStart)}
      organisations={organisations}
      days={days}
      events={monthEvents}
      tasks={monthTasks}
    />
  );
}
