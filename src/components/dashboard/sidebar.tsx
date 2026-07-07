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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/actions/auth';
import { BrandMark } from '@/components/site/brand-mark';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Documents', href: '/dashboard/documents', icon: FolderLock },
  { label: 'Evidence Vault', href: '/dashboard/evidence', icon: UploadCloud },
  { label: 'Compliance Calendar', href: '/dashboard/calendar', icon: CalendarDays },
  { label: 'Requests', href: '/dashboard/requests', icon: MessagesSquare },
  { label: 'Alerts', href: '/dashboard/alerts', icon: Bell },
  { label: 'Account', href: '/dashboard/account', icon: UserCircle2 },
];

export interface SidebarUser {
  email: string;
  businessName: string;
  planLabel: string;
}

export function DashboardSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-background border-r flex flex-col">
      <div className="p-6">
        <BrandMark href="/" />
      </div>

      <nav className="flex-1 px-4 space-y-1" aria-label="Dashboard">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'text-foreground bg-accent/10 border-l-2 border-[hsl(220,45%,45%)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon size={20} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-[hsl(220,50%,15%)] flex items-center justify-center shrink-0">
            <span className="text-[hsl(36,33%,97%)] text-xs font-semibold">
              {user.businessName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" title={user.email}>
              {user.businessName}
            </p>
            <p className="text-xs text-muted-foreground">{user.planLabel}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-2 w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
