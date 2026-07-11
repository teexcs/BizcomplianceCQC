'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

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

const faqSections = [
  {
    title: 'The audit',
    items: [
      { q: 'How does the one-off CQC readiness audit work?', a: 'You book the audit, send the evidence you already have and we complete a manual review across the five CQC areas before returning a written report and action plan.' },
      { q: 'What information do you need from me?', a: 'We usually need your provider details, the service type, policies, audits, training records, governance notes and any recent inspection or improvement documents.' },
      { q: 'How long does delivery take?', a: 'The review is completed after we receive your evidence. You then get a PDF report with risk-rated findings and 7 days of clarification support.' },
    ],
  },
  {
    title: 'Providers',
    items: [
      { q: 'Is this suitable for new providers?', a: 'Yes. It is designed for providers preparing for registration or a first inspection, as well as registered services that want a clearer baseline.' },
      { q: 'Do you work with domiciliary care and supported living?', a: 'Yes. Those are two of the main provider types we support, alongside care homes and healthcare clinics.' },
      { q: 'Can you help if we are already preparing for inspection?', a: 'Yes. The audit is specifically designed to highlight the issues that matter before an inspection and turn them into a priority action plan.' },
    ],
  },
  {
    title: 'Results and support',
    items: [
      { q: 'Can you guarantee inspection outcomes?', a: 'No. BizCompliance CQC is not the Care Quality Commission and we never promise a pass or a specific result. The audit is there to improve readiness and evidence.' },
      { q: 'What happens after the report is delivered?', a: 'You receive the PDF audit report, a readiness score, risk-rated findings and a clear priority action plan. Clarification is available for 7 days after delivery.' },
      { q: 'Why is the audit currently £595?', a: 'BizCompliance periodically offers reduced pricing. The standard audit fee is £795, and the current rate may be withdrawn at any time.' },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">FAQ</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            Questions about the CQC audit
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16">
            Answers for care providers planning a readiness review, preparing for inspection or wanting clearer evidence before the next visit.
          </p>
        </ScrollReveal>

        {faqSections.map((section, si) => (
          <ScrollReveal key={section.title} delay={si * 100}>
            <div className="mb-12">
              <h2 className="font-display text-xl font-semibold mb-4">{section.title}</h2>
              <Accordion>
                {section.items.map((item, i) => (
                  <AccordionItem key={i} value={`${section.title}-${i}`}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent>{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
