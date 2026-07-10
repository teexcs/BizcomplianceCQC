'use client';

import { useState } from 'react';
import { MoonStar, SunMedium } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASHBOARD_THEME_COOKIE, type DashboardTheme } from '@/lib/dashboard-theme';

function setDashboardTheme(theme: DashboardTheme, shellId: string) {
  const shell = document.getElementById(shellId);
  if (shell) {
    shell.classList.toggle('dark', theme === 'dark');
  }
  document.cookie = `${DASHBOARD_THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function DashboardThemeToggle({
  initialTheme,
  shellId,
  className,
}: {
  initialTheme: DashboardTheme;
  shellId: string;
  className?: string;
}) {
  const [theme, setTheme] = useState<DashboardTheme>(initialTheme);

  const dark = theme === 'dark';
  const Icon = dark ? SunMedium : MoonStar;

  return (
    <button
      type="button"
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setTheme(next);
        setDashboardTheme(next, shellId);
      }}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted',
        className,
      )}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
