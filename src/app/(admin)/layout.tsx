import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/sidebar';
import { getSessionContext } from '@/lib/data/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence in depth: middleware checks ADMIN_EMAILS; this checks the DB role.
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login?next=/admin');
  if (!ctx.isAdmin) redirect('/dashboard');

  return (
    <div className="dark min-h-screen flex bg-background text-foreground">
      <AdminSidebar email={ctx.email} />
      <main className="flex-1 min-w-0">
        <div className="p-6 md:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
