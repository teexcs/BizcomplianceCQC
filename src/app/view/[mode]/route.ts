import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/data/session';
import { VIEW_MODE_COOKIE, type ViewMode } from '@/lib/view-mode';

function isViewMode(value: string): value is ViewMode {
  return value === 'admin' || value === 'client';
}

function safeTarget(mode: ViewMode, next: string | null): string {
  const fallback = mode === 'client' ? '/dashboard' : '/admin';
  if (!next || !next.startsWith('/')) return fallback;
  if (mode === 'client' && !next.startsWith('/dashboard')) return fallback;
  if (mode === 'admin' && !next.startsWith('/admin')) return fallback;
  return next;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ mode: string }> }) {
  const { mode: rawMode } = await params;
  if (!isViewMode(rawMode)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const ctx = await getSessionContext();
  if (!ctx?.isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const next = safeTarget(rawMode, request.nextUrl.searchParams.get('next'));
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(VIEW_MODE_COOKIE, rawMode, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
