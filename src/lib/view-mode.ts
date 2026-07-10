import { cookies } from 'next/headers';

export type ViewMode = 'admin' | 'client';

export const VIEW_MODE_COOKIE = 'bizcompliance-view-mode';

export async function getViewMode(): Promise<ViewMode> {
  const store = await cookies();
  const raw = store.get(VIEW_MODE_COOKIE)?.value;
  return raw === 'client' ? 'client' : 'admin';
}
