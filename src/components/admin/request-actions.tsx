'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { updateRequestStatus } from '@/lib/actions/admin';

type Status = 'open' | 'in_review' | 'delivered' | 'closed';

export function RequestStatusSelect({ requestId, status }: { requestId: string; status: Status }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={busy}
      aria-label="Request status"
      className="w-36 h-9 text-xs"
      onChange={(e) => {
        const next = e.target.value as Status;
        startTransition(async () => {
          await updateRequestStatus(requestId, next);
          router.refresh();
        });
      }}
    >
      <option value="open">Open</option>
      <option value="in_review">In review</option>
      <option value="delivered">Delivered</option>
      <option value="closed">Closed</option>
    </Select>
  );
}
