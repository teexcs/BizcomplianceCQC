import { redirect } from 'next/navigation';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { getSessionContext } from '@/lib/data/session';
import { PLANS } from '@/lib/stripe/plans';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login?next=/dashboard');
  if (ctx.isAdmin) redirect('/admin');
  if (!ctx.org) redirect('/login');

  const planLabel = ctx.subscription
    ? `${PLANS[ctx.subscription.plan]?.name ?? ctx.subscription.plan} plan`
    : 'Pay-as-you-go';

  return (
    <div className="min-h-screen flex">
      <DashboardSidebar
        user={{
          email: ctx.email,
          businessName: ctx.org.name,
          planLabel,
        }}
      />
      <main className="flex-1 min-w-0 bg-muted/20">
        <div className="p-6 md:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
