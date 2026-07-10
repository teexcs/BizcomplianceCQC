import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/sidebar';
import { getSessionContext } from '@/lib/data/session';
import { getViewMode } from '@/lib/view-mode';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence in depth: middleware checks ADMIN_EMAILS; this checks the DB role.
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login?next=/admin');
  if (!ctx.isAdmin) redirect('/dashboard');
  const viewMode = await getViewMode();
  if (viewMode === 'client') redirect('/dashboard');

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <AdminSidebar email={ctx.email} viewMode={viewMode} showViewSwitch={ctx.isAdmin} />
      <main className="flex-1 min-w-0">
        <div className="p-6 md:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
