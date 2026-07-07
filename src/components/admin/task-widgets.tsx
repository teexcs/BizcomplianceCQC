'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createTask, toggleTask } from '@/lib/actions/admin';

export function TaskCheckbox({
  taskId,
  completed,
  title,
}: {
  taskId: string;
  completed: boolean;
  title: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={completed}
      disabled={busy}
      aria-label={`Mark "${title}" ${completed ? 'incomplete' : 'complete'}`}
      className="h-4 w-4 accent-[hsl(36,45%,55%)] cursor-pointer"
      onChange={(e) => {
        const next = e.target.checked;
        startTransition(async () => {
          await toggleTask(taskId, next);
          router.refresh();
        });
      }}
    />
  );
}

const EMPTY = { title: '', priority: 'medium' as 'low' | 'medium' | 'high', due_date: '' };

export function NewTaskForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTask({
        title: form.title,
        detail: '',
        kind: 'admin',
        priority: form.priority,
        due_date: form.due_date,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not create the task.');
        return;
      }
      setForm(EMPTY);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px] space-y-1.5">
          <Label htmlFor="task-title">New task</Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Review Oakfield's safeguarding evidence"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            id="task-priority"
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))
            }
            className="w-32"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-due">Due</Label>
          <Input
            id="task-due"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            className="w-40"
          />
        </div>
        <button
          type="button"
          disabled={busy || form.title.length < 3}
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 h-10 text-sm font-medium disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" /> Add
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
