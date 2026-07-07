'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'Who it’s for', href: '/#who' },
  { label: 'What’s included', href: '/#included' },
  { label: 'CQC areas', href: '/#areas' },
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
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-colors duration-200',
        scrolled
          ? 'bg-[hsl(36,33%,97%)] border-b border-border'
          : 'bg-[hsl(36,33%,97%)]',
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="font-display text-xl md:text-2xl font-semibold tracking-tight text-[hsl(220,33%,8%)]">
            BizCompliance CQC
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
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
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
            >
              Book Your CQC Audit
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden p-2 -mr-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>
          </button>
        </div>
      </div>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="right">
        <div className="pt-8">
          <nav className="flex flex-col gap-4">
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
                Log in
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
              >
                Book Your CQC Audit
              </Link>
            </div>
          </nav>
        </div>
      </Sheet>
    </header>
  );
}
