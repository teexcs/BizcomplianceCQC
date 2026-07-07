'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/site/brand-mark';

const navLinks = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Services', href: '/services' },
  { label: 'Who we cover', href: '/sectors' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[hsl(36,33%,97%)]/85 backdrop-blur-xl border-b border-border shadow-[0_1px_0_rgba(21,32,58,0.04)]'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <BrandMark href="/" />

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-5">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/#start"
              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-10 px-5 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,20%)] transition-colors shadow-[0_8px_24px_-10px_rgba(21,32,58,0.5)]"
            >
              Get started free
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden p-2.5 -mr-2 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="right">
        <div className="pt-8">
          <nav className="flex flex-col gap-4" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-base font-medium text-foreground hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t flex flex-col gap-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/#start"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-11 px-5 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,20%)] transition-colors"
              >
                Get started free
              </Link>
            </div>
          </nav>
        </div>
      </Sheet>
    </header>
  );
}
