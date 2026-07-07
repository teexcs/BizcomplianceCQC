'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { submitRequest } from '@/lib/actions/client';

const REQUEST_TYPES = [
  'Policy update',
  'New document request',
  'Evidence review',
  'Safeguarding query',
  'Medicines management query',
  'Recruitment / DBS query',
  'Inspection preparation',
  'Other',
];

export function RequestForm() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    const result = await submitRequest({ type, priority, description });
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong.');
    } else {
      setSuccess(true);
      setType('');
      setPriority('medium');
      setDescription('');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="req-type">Request type</Label>
          <Select id="req-type" value={type} onChange={(e) => setType(e.target.value)} required>
            <option value="">Select a type</option>
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="req-priority">Priority</Label>
          <Select
            id="req-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="req-description">What do you need?</Label>
        <Textarea
          id="req-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          placeholder="Describe the document, review or question — include the CQC area if you know it."
        />
        <p className="text-xs text-muted-foreground">Minimum 10 characters.</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm text-green-700">
          Request submitted — you&apos;ll get an email when it&apos;s updated.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading || !type || description.length < 10}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Submit request'}
      </button>
      {type === 'Evidence review' || type === 'New document request' ? (
        <p className="text-xs text-muted-foreground">
          Tip: upload any supporting files to your{' '}
          <a href="/dashboard/evidence" className="text-[hsl(36,45%,45%)] hover:underline">
            evidence vault
          </a>{' '}
          and mention them here.
        </p>
      ) : null}
    </form>
  );
}
