'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
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

const articles = [
  { slug: 'gdpr-basics-small-business', title: 'GDPR basics for small businesses', desc: 'A plain-English guide to the General Data Protection Regulation for UK small businesses. What you actually need to do.', date: '2025-04-15', readTime: '8 min read' },
  { slug: 'ico-registration-guide', title: 'ICO registration: a step-by-step guide', desc: 'Do you need to register with the Information Commissioner? How to do it, how much it costs, and what happens if you don\'t.', date: '2025-04-10', readTime: '6 min read' },
  { slug: 'cookie-consent-explained', title: 'Cookie consent: what the law actually says', desc: 'The rules on cookie consent in the UK, including the difference between essential and non-essential cookies.', date: '2025-04-05', readTime: '7 min read' },
  { slug: 'asa-advertising-rules', title: 'ASA advertising rules for online businesses', desc: 'How to ensure your online advertising complies with the Advertising Standards Authority\'s CAP Code.', date: '2025-03-28', readTime: '10 min read' },
  { slug: 'subject-access-requests', title: 'Handling Subject Access Requests', desc: 'What to do when someone requests their data. Your obligations, timeframes, and exemptions under GDPR.', date: '2025-03-20', readTime: '9 min read' },
  { slug: 'companies-house-filing', title: 'Companies House filing requirements', desc: 'A complete guide to confirmation statements, annual accounts, and keeping your company information up to date.', date: '2025-03-15', readTime: '7 min read' },
];

export default function ResourcesPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(36,45%,45%)] mb-4">Resources</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            Compliance library
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16 max-w-2xl">
            Plain-English guides to UK compliance for small businesses. Written by our team of legally trained professionals.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, i) => (
            <ScrollReveal key={article.slug} delay={i * 80}>
              <Link href={`/resources/${article.slug}`}>
                <Card className="h-full group border hover:border-foreground/20 hover:shadow-md transition-all duration-280">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground font-mono uppercase tracking-wider">
                      <span>{new Date(article.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>&middot;</span>
                      <span>{article.readTime}</span>
                    </div>
                    <h2 className="font-display text-lg font-semibold mb-2 group-hover:text-[hsl(36,45%,45%)] transition-colors">
                      {article.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{article.desc}</p>
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
