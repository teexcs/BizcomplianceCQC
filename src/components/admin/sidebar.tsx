'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardCheck,
  FolderSearch,
  Library,
  Users,
  MessagesSquare,
  Bell,
  ListChecks,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { signOut } from '@/lib/actions/auth';
import { BrandMark } from '@/components/site/brand-mark';

const navItems = [
  { label: 'Command Centre', href: '/admin', icon: LayoutDashboard },
  { label: 'Audit Pipeline', href: '/admin/audits', icon: ClipboardCheck },
  { label: 'Evidence Review', href: '/admin/evidence', icon: FolderSearch },
  { label: 'Library', href: '/admin/library', icon: Library },
  { label: 'Clients', href: '/admin/customers', icon: Users },
  { label: 'Requests', href: '/admin/requests', icon: MessagesSquare },
  { label: 'Alerts', href: '/admin/alerts', icon: Bell },
  { label: 'Tasks', href: '/admin/tasks', icon: ListChecks },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen border-r border-border bg-card flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div>
          <BrandMark href="/admin" className="items-start" subtitle="CQC Audit OS" />
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase tracking-wider mt-0.5"
          >
            Operational dashboard
          </Badge>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1" aria-label="Admin">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'text-foreground bg-accent/15 ring-1 ring-[hsl(220,45%,55%)]/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="px-4 text-xs text-muted-foreground truncate" title={email}>
          {email}
        </p>
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
