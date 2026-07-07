'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

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

const pillars = [
  { title: 'Mapped to statute', desc: 'Every document we produce is cross-referenced against current UK legislation. We do not use templates pulled from the internet \u2014 our work is grounded in statute.' },
  { title: 'Reviewed by humans', desc: 'No automation, no AI-generated documents. Every audit report and legal document is drafted and reviewed by a legally trained professional.' },
  { title: 'Updated when the law changes', desc: 'UK regulations evolve constantly. Our subscription clients receive proactive updates whenever legislation affecting their business changes.' },
];

const advisors = [
  { name: 'Dr. Catherine Moore', role: 'Data Protection Advisor', bio: 'Former ICO enforcement officer with 15 years of regulatory experience. Advises on complex data protection matters.' },
  { name: 'James Whitfield', role: 'Commercial Law Advisor', bio: 'Solicitor with 20 years of commercial and contract law experience. Reviews our terms and commercial documents.' },
  { name: 'Dr. Amina Patel', role: 'Sector Regulation Advisor', bio: 'Former MHRA regulatory scientist specialising in cosmetic and healthcare product regulations.' },
];

export default function AboutPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        {/* Founder note */}
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(36,45%,45%)] mb-4">About</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-12">
            Built by a UK law graduate,<br className="hidden md:block" />led by compliance specialists
          </h1>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start mb-24">
          <ScrollReveal>
            <div className="relative aspect-[4/5] max-w-md mx-auto lg:mx-0 overflow-hidden rounded-lg bg-muted">
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=750&fit=crop&crop=face" alt="Founder portrait" className="w-full h-full object-cover" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="space-y-6">
              <p className="text-lg leading-relaxed">
                BizCompliance was founded by a UK law graduate (LLB, London) who saw first-hand how small businesses struggle with regulatory compliance. After working with hundreds of SMBs, it became clear that most businesses want to do the right thing \u2014 they simply do not know where to start.
              </p>
              <p className="text-lg leading-relaxed">
                Our practice is built on a simple principle: every UK business deserves access to professional compliance support at a price they can afford. We are not a law firm. We are a compliance practice that combines legal training with practical business sense.
              </p>
              <p className="text-lg leading-relaxed">
                Today, our team includes compliance specialists, data protection advisors, and sector-specific experts who work together to keep our clients on the right side of regulation. We are based in London and serve businesses across the United Kingdom.
              </p>
              <blockquote className="font-display text-xl italic text-[hsl(220,50%,15%)] border-l-2 border-[hsl(36,45%,45%)] pl-6 my-8">
                &ldquo;We believe compliance is not a burden \u2014 it is a competitive advantage. Businesses that operate with integrity build stronger relationships with their customers.&rdquo;
              </blockquote>
            </div>
          </ScrollReveal>
        </div>

        {/* Methodology pillars */}
        <ScrollReveal>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-8">Our methodology</h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {pillars.map((pillar, i) => (
            <ScrollReveal key={pillar.title} delay={i * 100}>
              <Card className="h-full border">
                <CardContent className="p-6">
                  <h3 className="font-display text-lg font-semibold mb-3">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pillar.desc}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* Advisory network */}
        <ScrollReveal>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-8">Advisory network</h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {advisors.map((advisor, i) => (
            <ScrollReveal key={advisor.name} delay={i * 100}>
              <Card className="h-full border">
                <CardContent className="p-6">
                  <h3 className="font-display text-lg font-semibold mb-1">{advisor.name}</h3>
                  <p className="text-sm text-[hsl(36,45%,45%)] mb-3">{advisor.role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{advisor.bio}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* What we don't do */}
        <ScrollReveal>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">What we don&apos;t do</h2>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {[
              'We do not provide legal advice on individual disputes or litigation',
              'We do not represent clients in court or before regulators',
              'We do not use AI to generate compliance documents',
              'We do not offer template-based document services',
              'We do not claim to be solicitors or a law firm',
              'We do not guarantee specific outcomes from compliance work',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Location */}
        <ScrollReveal delay={150}>
          <div className="mt-16 p-6 border rounded-xl bg-muted/30 max-w-2xl">
            <h3 className="font-display text-lg font-semibold mb-2">Our office</h3>
            <p className="text-sm text-muted-foreground">BizCompliance Ltd<br/>12 Farringdon Road<br/>London EC1M 3EN<br/>United Kingdom</p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
