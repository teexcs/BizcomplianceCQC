'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

// Worked examples of what the audit finds and fixes \u2014 anonymised composites of
// the failure patterns we see most, not named client engagements.
const caseStudies = [
  {
    sector: 'Domiciliary care',
    title: 'Recruitment files that fail Schedule 3 \u2014 found before the inspector does',
    challenge: 'A typical home care provider passes most areas comfortably, then loses a rating on Regulation 19: staff files missing full employment history, references that were never followed up, and DBS checks with no risk assessment for staff who started before clearance.',
    approach: 'The audit works through all 139 evidence points, flags every Schedule 3 gap as a legally-required RED item, and issues the Safe Recruitment pack \u2014 pre-employment checklist, DBS risk assessment and recruitment checks register \u2014 with a fix-first action plan.',
    result: 'The provider closes the gap with a documented, repeatable recruitment process and can evidence every file at inspection. Recruitment stops being the area most likely to drag down the Well-led rating.',
    scoreBefore: 54,
    scoreAfter: 82,
  },
  {
    sector: 'Supported living',
    title: 'Consent that is happening in practice but invisible on paper',
    challenge: 'Staff know their service users well and involve them in decisions daily \u2014 but capacity assessments are missing, best-interests decisions are undocumented, and nothing evidences how consent was actually sought.',
    approach: 'The audit maps the consent and mental capacity area against Regulation 11 and the MCA 2005, then issues the capacity assessment forms, best-interests decision records and capacity decisions log, with SAF interview preparation for the Effective key question.',
    result: 'Good practice becomes provable practice. The provider walks into inspection with a written trail from capacity assessment to best-interests decision for every relevant person.',
    scoreBefore: 61,
    scoreAfter: 85,
  },
  {
    sector: 'Residential care',
    title: 'A medicines audit trail an inspector can actually follow',
    challenge: 'MAR charts are completed, but weekly audits are unsigned, discrepancies are fixed informally, and the controlled drugs register misses dual signatures at handover \u2014 classic Regulation 12(2)(g) territory.',
    approach: 'The audit rates the medicines area, issues the full medicines management pack \u2014 audit tool, error and near-miss pathway, escalation form and CD register \u2014 and sets a 7-day action window with named owners.',
    result: 'Every medicines event now has a documented pathway from error to investigation to learning, which is exactly the trail the Safe key question is scored on.',
    scoreBefore: 58,
    scoreAfter: 80,
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">Worked examples</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            What the audit finds, and how it gets fixed
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16 max-w-2xl">
            Anonymised composites of the failure patterns we see most often in CQC-registered
            services — and the exact route from red finding to inspection-ready evidence. Scores
            shown are illustrative readiness scores out of 100.
          </p>
        </ScrollReveal>

        <div className="space-y-12">
          {caseStudies.map((cs, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <Card className="border">
                <CardContent className="p-6 md:p-10">
                  <Badge variant="secondary" className="mb-4">{cs.sector}</Badge>
                  <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">{cs.title}</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Challenge</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{cs.challenge}</p>
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Our approach</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{cs.approach}</p>
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Result</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{cs.result}</p>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="text-center">
                          <p className="font-display text-2xl text-muted-foreground">{cs.scoreBefore}</p>
                          <p className="text-xs text-muted-foreground">Before</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[hsl(220,45%,45%)]"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        <div className="text-center">
                          <p className="font-display text-2xl text-[hsl(220,45%,45%)]">{cs.scoreAfter}</p>
                          <p className="text-xs text-muted-foreground">After</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
