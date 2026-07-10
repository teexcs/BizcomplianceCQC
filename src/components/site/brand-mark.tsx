'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  href?: string;
  className?: string;
  label?: string;
  accent?: string;
  subtitle?: string;
  accentClassName?: string;
};

export function BrandMark({
  href = '/',
  className,
  label = 'BizCompliance',
  accent = 'CQC',
  subtitle,
  accentClassName,
}: BrandMarkProps) {
  return (
    <Link href={href} className={cn('inline-flex flex-col items-start leading-none', className)}>
      <span className="font-display text-lg md:text-xl lg:text-2xl font-semibold tracking-tight text-foreground">
        {label}
        <span className={cn('text-foreground', accentClassName)}> {accent}</span>
      </span>
      {subtitle ? (
        <span className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </Link>
  );
}
