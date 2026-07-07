'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  href?: string;
  className?: string;
  label?: string;
  accent?: string;
  subtitle?: string;
};

export function BrandMark({
  href = '/',
  className,
  label = 'BizCompliance',
  accent = 'CQC',
  subtitle,
}: BrandMarkProps) {
  return (
    <Link href={href} className={cn('inline-flex flex-col items-start leading-none', className)}>
      <span className="font-display text-lg md:text-xl font-semibold tracking-tight text-[hsl(220,33%,8%)]">
        {label}
        <span className="text-[hsl(220,33%,8%)]"> {accent}</span>
      </span>
      {subtitle ? (
        <span className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </Link>
  );
}
