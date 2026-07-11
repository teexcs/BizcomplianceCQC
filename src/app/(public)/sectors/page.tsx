'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { DOMICILIARY_ONLY } from '@/lib/site-focus';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function ScrollReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} className={cn('transition-all duration-700 ease-out', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const allSectors = [
  { slug: 'domiciliary-care', title: 'Domiciliary care', desc: 'Lone working, medicines in the home, Schedule 3 recruitment files and travel-buffered rotas — our deepest pack, built for all 18 CQC areas.', icon: '' },
  { slug: 'supported-living', title: 'Supported living', desc: 'Mental capacity, best-interests decisions, positive risk-taking and genuinely person-centred planning evidence.', icon: '' },
  { slug: 'care-home', title: 'Residential care homes', desc: 'Premises safety, IPC, dependency-based staffing, controlled drugs governance and the full medicines cycle.', icon: '' },
  { slug: 'clinic', title: 'Clinics & treatment services', desc: 'Consent records, duty of candour, statutory notifications and governance for independent healthcare.', icon: '' },
  { slug: 'new-provider', title: 'New providers', desc: 'Pre-registration document foundations, Statement of Purpose and registered manager evidence that stand up to CQC scrutiny.', icon: '' },
];

const sectors = DOMICILIARY_ONLY
  ? allSectors.filter((s) => s.slug === 'domiciliary-care')
  : allSectors;

export default function SectorsPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">Services we cover</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            {DOMICILIARY_ONLY ? 'Built for domiciliary care' : 'Built for CQC-registered care services'}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16 max-w-2xl">
            {DOMICILIARY_ONLY
              ? 'We audit against the same Fundamental Standards every CQC-registered service is inspected on, with a library built domiciliary-care-first — lone working, medicines in the home, and the evidence that actually gets checked at inspection.'
              : 'Every service type is inspected on the same Fundamental Standards, but the evidence that proves them differs. Choose your service to see what your audit covers.'}
          </p>
        </ScrollReveal>

        <div
          className={cn(
            'grid grid-cols-1 gap-6',
            DOMICILIARY_ONLY ? 'md:grid-cols-1 max-w-xl' : 'md:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {sectors.map((sector, i) => (
            <ScrollReveal key={sector.slug} delay={i * 80}>
              <Link href={`/sectors/${sector.slug}`}>
                <Card className="h-full group border hover:border-foreground/20 hover:shadow-md transition-all duration-280">
                  <CardContent className="p-6 md:p-8">
                    <h2 className="font-display text-xl font-semibold mb-3 group-hover:text-[hsl(220,45%,45%)] transition-colors">
                      {sector.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{sector.desc}</p>
                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[hsl(220,45%,45%)] group-hover:gap-2 transition-all duration-200">
                      Explore pack
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
