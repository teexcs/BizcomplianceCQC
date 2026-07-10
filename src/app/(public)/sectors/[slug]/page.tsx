'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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

const sectorData: Record<string, {
  title: string;
  hero: string;
  painPoints: string[];
  packIncludes: string[];
  tierRequired: string;
  caseStudies: { name: string; desc: string; result: string }[];
}> = {
  'domiciliary-care': {
    title: 'Domiciliary care',
    hero: 'Home care providers are inspected on evidence they can rarely lay hands on quickly: lone working arrangements, medicines support in people’s own homes, travel-buffered rotas and remote supervision. Our library was built for domiciliary care first and covers all 18 CQC compliance areas.',
    painPoints: [
      'Lone working risk assessments are legally required under MHSWR 1999 but often missing',
      'MAR charts and medicines audits are hard to evidence across dispersed home visits',
      'Schedule 3 recruitment files fail inspection more than any other single area',
      'Care plan reviews happen, but the written trail rarely proves frequency',
      'Statutory notifications to CQC are missed because no one owns the decision',
    ],
    packIncludes: [
      'Full 18-area document review against the 139-point checklist',
      'Statement of Purpose and registration pack (2009 Regs, Schedule 3)',
      'Safeguarding, medicines, consent and recruitment document packs',
      'Lone working and staff safety risk assessment suite',
      'SAF interview preparation across all five key questions',
      'Priority action plan with fix-first, 7-day and 14-day windows',
    ],
    tierRequired: 'audit',
    caseStudies: [],
  },
  'supported-living': {
    title: 'Supported living',
    hero: 'Supported living sits at the sharp edge of consent and capacity law. Inspectors look for Mental Capacity Act evidence, best-interests decision records and genuine service-user involvement — not just policies on a shelf.',
    painPoints: [
      'Capacity assessments missing or completed after decisions were made',
      'Deprivation of liberty risks in supported settings are poorly documented',
      'Positive risk-taking rarely co-produced with the person and family',
      'Tenancy and care boundaries blur, confusing regulatory responsibility',
      'Person-centred plans read identically across different service users',
    ],
    packIncludes: [
      'Consent and mental capacity document pack (MCA 2005 aligned)',
      'Best interests decision forms and capacity decision log',
      'Person-centred care planning suite',
      'Safeguarding and whistleblowing pack',
      'Dignity, equality and service-user rights documents',
      'Readiness audit mapped to the Single Assessment Framework',
    ],
    tierRequired: 'audit',
    caseStudies: [],
  },
  'care-home': {
    title: 'Residential care homes',
    hero: 'Care homes carry the widest evidence burden: premises safety, fire, IPC, nutrition, activities, staffing dependency and the full medicines cycle. The audit tells you exactly which of the 18 areas would hold up a rating today.',
    painPoints: [
      'Fire safety and premises checks logged inconsistently across shifts',
      'IPC audits exist but scored action plans are missing',
      'Dependency-based staffing calculations rarely documented',
      'Controlled drugs governance fails dual-signature requirements',
      'Governance meetings happen but actions have no owners or deadlines',
    ],
    packIncludes: [
      'Safe care and risk management document suite',
      'Medicines management pack including CD register and error pathway',
      'IPC policy, procedure and audit tools',
      'Staffing, training and supervision framework',
      'Health & safety pack (HSWA, fire, COSHH, RIDDOR)',
      'Governance, QA and records suite',
    ],
    tierRequired: 'audit',
    caseStudies: [],
  },
  clinic: {
    title: 'Clinics & treatment services',
    hero: 'Independent clinics face CQC scrutiny with leaner teams and less compliance infrastructure than large providers. The essentials still apply in full: consent, safe care, duty of candour, notifications and good governance.',
    painPoints: [
      'Consent records don’t evidence how information was actually given',
      'Duty of candour obligations misunderstood or applied with the wrong threshold',
      'Statutory notifications to CQC missed for reportable incidents',
      'Data protection documentation missing the Article 30 ROPA',
      'Business continuity untested and undocumented',
    ],
    packIncludes: [
      'Consent to care and treatment pack',
      'Duty of candour policy, procedure, record and log',
      'CQC notifications policy and decision tool',
      'Data protection and confidentiality suite (UK GDPR / DPA 2018)',
      'Complaints and feedback pack',
      'Business continuity and emergency planning documents',
    ],
    tierRequired: 'audit',
    caseStudies: [],
  },
  'new-provider': {
    title: 'New providers (pre-registration)',
    hero: 'Registering with CQC means proving compliance before you deliver a single hour of care. We build your document foundation and assess it the way an inspector would, so your registration application stands up.',
    painPoints: [
      'Statement of Purpose missing Schedule 3 required content',
      'Registered manager applications fail on evidence of fitness',
      'Policy sets bought online don’t match the service actually proposed',
      'Recruitment files incomplete before first hires are made',
      'No audit trail exists because the service hasn’t started — evidence must be structural',
    ],
    packIncludes: [
      'Registration & Statement of Purpose pack (2009 Regs)',
      'Full foundational policy library issued for your service type',
      'Safe recruitment and DBS framework ready for first hires',
      'Governance and QA structure with audit calendar',
      'Pre-registration readiness audit with gap analysis',
      'Priority action plan sequenced for your registration timeline',
    ],
    tierRequired: 'audit',
    caseStudies: [],
  },
};

export default function SectorDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const sector = sectorData[slug];

  if (!sector) {
    return (
      <div className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12 text-center">
          <h1 className="font-display text-3xl mb-4">Sector not found</h1>
          <p className="text-muted-foreground mb-8">We couldn&apos;t find the sector you&apos;re looking for.</p>
          <Link href="/sectors" className="text-[hsl(220,45%,45%)] hover:underline">View all sectors</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">Sector pack</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            {sector.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16">
            {sector.hero}
          </p>
        </ScrollReveal>

        {/* Pain points */}
        <ScrollReveal delay={100}>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">Key compliance challenges</h2>
          <ul className="space-y-4 mb-16">
            {sector.painPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[hsl(220,45%,45%)] mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span className="text-muted-foreground leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>

        {/* What's in the pack */}
        <ScrollReveal delay={150}>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">What&apos;s in the pack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            {sector.packIncludes.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 border rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[hsl(220,45%,45%)] mt-1 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Case studies */}
        {sector.caseStudies.length > 0 && (
          <ScrollReveal delay={200}>
            <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">Case studies</h2>
            <div className="space-y-6 mb-16">
              {sector.caseStudies.map((cs, i) => (
                <Card key={i} className="border">
                  <CardContent className="p-6">
                    <h3 className="font-display text-lg font-semibold mb-2">{cs.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{cs.desc}</p>
                    <p className="text-sm leading-relaxed">{cs.result}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollReveal>
        )}

        {/* Tier requirement */}
        <ScrollReveal delay={250}>
          <div className="p-6 md:p-8 border rounded-xl bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground mb-2">Start with the</p>
            <Badge variant="default" className="mb-4">One-off CQC Readiness Audit · £595</Badge>
            <p className="text-sm text-muted-foreground mb-6">
              Documents for your critical gaps are issued with your audit report. Monthly plans keep
              them current and add ongoing support.
            </p>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-5 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors">
              View pricing
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
