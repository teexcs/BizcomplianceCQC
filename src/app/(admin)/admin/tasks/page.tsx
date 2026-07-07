import { Card, CardContent } from '@/components/ui/card';
import { getTasks } from '@/lib/data/admin';
import { NewTaskForm, TaskCheckbox } from '@/components/admin/task-widgets';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage() {
  const tasks = await getTasks();
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your operational to-do list. Audit purchases create tasks automatically.
        </p>
      </div>

      <NewTaskForm />

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-display text-lg tracking-tight mb-4">
            Open <span className="text-sm text-muted-foreground font-sans">({open.length})</span>
          </h2>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">All clear.</p>
          ) : (
            <ul className="divide-y divide-border">
              {open.map((t) => (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <TaskCheckbox taskId={t.id} completed={t.completed} title={t.title} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.kind}
                      {t.due_date ? ` · due ${formatDate(t.due_date)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      t.priority === 'high'
                        ? 'text-red-400'
                        : t.priority === 'medium'
                          ? 'text-amber-300'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {t.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {done.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Completed ({done.length})
          </summary>
          <Card className="mt-3">
            <CardContent className="pt-6">
              <ul className="divide-y divide-border">
                {done.slice(0, 25).map((t) => (
                  <li key={t.id} className="py-2.5 flex items-center gap-3">
                    <TaskCheckbox taskId={t.id} completed={t.completed} title={t.title} />
                    <p className="text-sm text-muted-foreground line-through flex-1">{t.title}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </details>
      ) : null}
    </div>
  );
}
