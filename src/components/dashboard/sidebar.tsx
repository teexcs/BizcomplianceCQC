'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderLock,
  CalendarDays,
  MessagesSquare,
  Bell,
  UserCircle2,
  LogOut,
  UploadCloud,
  ClipboardCheck,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/actions/auth';
import { BrandMark } from '@/components/site/brand-mark';
import { ViewModeCard } from '@/components/view-mode-card';
import { DashboardThemeToggle } from '@/components/dashboard/theme-toggle';
import type { DashboardTheme } from '@/lib/dashboard-theme';
import type { ViewMode } from '@/lib/view-mode';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** When present and false, the item shows a lock and routes to the gated page. */
  entitled?: boolean;
}

export interface SidebarUser {
  email: string;
  displayName: string;
  businessName: string;
  planLabel: string;
  safPrep: boolean;
}

export function DashboardSidebar({
  user,
  viewMode,
  showViewSwitch,
  theme,
}: {
  user: SidebarUser;
  viewMode: ViewMode;
  showViewSwitch: boolean;
  theme: DashboardTheme;
}) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Documents', href: '/dashboard/documents', icon: FolderLock },
    { label: 'Evidence Vault', href: '/dashboard/evidence', icon: UploadCloud },
    { label: 'Compliance Calendar', href: '/dashboard/calendar', icon: CalendarDays },
    { label: 'Requests', href: '/dashboard/requests', icon: MessagesSquare },
    { label: 'SAF Prep', href: '/dashboard/saf-prep', icon: ClipboardCheck, entitled: user.safPrep },
    { label: 'Alerts', href: '/dashboard/alerts', icon: Bell },
    { label: 'Account', href: '/dashboard/account', icon: UserCircle2 },
  ];

  return (
    <aside className="w-64 min-h-screen bg-background border-r flex flex-col">
      <div className="flex items-center gap-3 p-6 pb-4">
        <BrandMark href="/" accentClassName="ml-[1.65em] inline-block" />
        <DashboardThemeToggle initialTheme={theme} shellId="dashboard-shell" />
      </div>

      {showViewSwitch ? (
        <ViewModeCard
          currentMode={viewMode}
          switchHref={viewMode === 'client' ? '/view/admin?next=/admin' : '/view/client?next=/dashboard'}
          className="mb-4"
        />
      ) : null}

      <nav className="flex-1 px-4 space-y-1" aria-label="Dashboard">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const locked = item.entitled === false;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'text-foreground bg-accent/10 border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {locked ? (
                <Lock size={13} className="text-muted-foreground/50" aria-hidden="true" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-3">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold">
              {(user.displayName || user.businessName || user.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" title={user.displayName || user.email}>
              {user.displayName || user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={user.email}>
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.planLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
