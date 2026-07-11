/**
 * Single toggle for how many sectors the public site presents.
 *
 * 'domiciliary' — launch scope: only the domiciliary-care sector is shown/
 *   linked anywhere on the public site. Nothing is deleted — the other sector
 *   pages, their content and the full sectors index still exist in the code
 *   and render correctly if visited directly or once this flag flips back.
 * 'all' — the original multi-sector site (domiciliary, supported living,
 *   care home, clinic, new-provider).
 *
 * Flip with NEXT_PUBLIC_SITE_FOCUS in the environment (Vercel + .env.local).
 * Unset defaults to 'domiciliary' — the current launch focus.
 */
export type SiteFocus = 'domiciliary' | 'all';

export const SITE_FOCUS: SiteFocus =
  process.env.NEXT_PUBLIC_SITE_FOCUS === 'all' ? 'all' : 'domiciliary';

export const DOMICILIARY_ONLY = SITE_FOCUS === 'domiciliary';
