export type DashboardTheme = 'light' | 'dark';

export const DASHBOARD_THEME_COOKIE = 'bizcompliance-dashboard-theme';

export function normalizeDashboardTheme(value: string | undefined | null): DashboardTheme {
  return value === 'dark' ? 'dark' : 'light';
}
