import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { getSessionContext } from '@/lib/data/session';
import { DASHBOARD_THEME_COOKIE, normalizeDashboardTheme } from '@/lib/dashboard-theme';
import { PLANS } from '@/lib/stripe/plans';
import { getViewMode } from '@/lib/view-mode';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login?next=/dashboard');
  const viewMode = await getViewMode();
  const themeStore = await cookies();
  const theme = normalizeDashboardTheme(themeStore.get(DASHBOARD_THEME_COOKIE)?.value);

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isConfiguredAdmin = ctx.isAdmin && adminEmails.includes(ctx.email.toLowerCase());
  if (isConfiguredAdmin && viewMode !== 'client') redirect('/admin');

  if (!ctx.org) redirect('/login');

  const planLabel = ctx.testAccess
    ? 'Test access (all plans)'
    : ctx.subscription
      ? `${PLANS[ctx.subscription.plan]?.name ?? ctx.subscription.plan} plan`
      : 'Pay-as-you-go';

  return (
    <div
      id="dashboard-shell"
      className={`min-h-screen flex bg-background text-foreground ${theme === 'dark' ? 'dark' : ''}`}
    >
      <DashboardSidebar
        user={{
          email: ctx.email,
          displayName: ctx.profile.full_name?.trim() || ctx.email,
          businessName: ctx.org.name,
          planLabel,
          safPrep: ctx.entitlements.safPrep,
        }}
        viewMode={viewMode}
        showViewSwitch={ctx.isAdmin}
        theme={theme}
      />
      <main className="flex-1 min-w-0 bg-muted/20">
        <div className="p-6 md:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
