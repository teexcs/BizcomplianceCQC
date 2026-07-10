'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); }
    }, { threshold: 0.1 });
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

const categories = [
  {
    id: 'audits',
    label: 'Audits & readiness scoring',
    items: [
      { name: 'CQC Readiness Audit', desc: 'Manual review of your evidence across all 18 compliance areas and 139 evidence points, mapped to the Fundamental Standards.', tiers: ['audit'] },
      { name: 'Single Assessment Framework review', desc: 'Structured assessment against Safe, Effective, Caring, Responsive and Well-led — the way CQC actually inspects.', tiers: ['audit', 'professional'] },
      { name: 'Quarterly re-audit', desc: 'Regular re-assessment with an updated readiness score so improvement is visible and evidenced.', tiers: ['professional', 'partner'] },
      { name: 'Readiness score tracking', desc: 'A single 0–100 score with red/amber/green area ratings, recalculated as your evidence improves.', tiers: ['audit', 'professional', 'partner'] },
    ],
  },
  {
    id: 'documents',
    label: 'Compliance documents',
    items: [
      { name: 'Policy & procedure issue', desc: 'Documents from our 139-asset domiciliary care library, issued to your vault with document control and a 12-month review cycle.', tiers: ['audit', 'essentials', 'professional', 'partner'] },
      { name: 'Statement of Purpose & registration pack', desc: 'Registration-critical documents aligned to the CQC (Registration) Regulations 2009 and Schedule 3.', tiers: ['audit', 'essentials', 'professional', 'partner'] },
      { name: 'Safeguarding, medicines & consent packs', desc: 'The high-risk areas inspectors test first — policies, forms, registers and competency assessments.', tiers: ['audit', 'essentials', 'professional', 'partner'] },
      { name: 'Document update service', desc: 'Issued documents kept current as regulations and CQC guidance change.', tiers: ['essentials', 'professional', 'partner'] },
    ],
  },
  {
    id: 'evidence',
    label: 'Evidence & inspection prep',
    items: [
      { name: 'Secure evidence vault', desc: 'Upload policies, registers and records; everything is organised by compliance area for inspection day.', tiers: ['audit', 'essentials', 'professional', 'partner'] },
      { name: 'Evidence review & feedback', desc: 'Your auditor reviews uploads and tells you what is missing, out of date or below standard.', tiers: ['professional', 'partner'] },
      { name: 'Mock SAF interview preparation', desc: 'The 68-question interview sheet inspectors use as a framework, completed with you before the real thing.', tiers: ['professional'] },
      { name: 'Priority action planning', desc: 'Fix-first, 7-day and 14-day actions with owners — a plan you can hand to your team.', tiers: ['audit', 'professional', 'partner'] },
    ],
  },
  {
    id: 'ongoing',
    label: 'Ongoing programmes',
    items: [
      { name: 'Compliance calendar', desc: 'Statutory deadlines, review cycles and audit milestones with reminders.', tiers: ['essentials', 'professional', 'partner'] },
      { name: 'CQC regulatory alerts', desc: 'Plain-English updates when guidance or regulations change, mapped to the key questions.', tiers: ['essentials', 'professional', 'partner'] },
      { name: 'Document requests', desc: 'Ask for new documents, reviews or updates from your dashboard, with tracked turnaround.', tiers: ['essentials', 'professional', 'partner'] },
      { name: 'Quarterly compliance call', desc: 'A scheduled call with your auditor to review readiness and plan the next quarter.', tiers: ['professional', 'partner'] },
    ],
  },
];

const tierBadges: Record<string, { label: string; variant: string }> = {
  audit: { label: 'One-off audit', variant: 'destructive' },
  essentials: { label: 'Essentials', variant: 'secondary' },
  professional: { label: 'Professional', variant: 'default' },
  partner: { label: 'Partner', variant: 'outline' },
};

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState('audits');
  const activeCategory = categories.find((c) => c.id === activeTab) ?? categories[0];

  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">Services</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            Everything a care provider needs to face CQC with confidence
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16 max-w-2xl">
            Readiness audits, a specialist compliance library, evidence review and ongoing
            support — mapped to the HSCA 2008 Regulated Activities Regulations and the CQC Single
            Assessment Framework.
          </p>
        </ScrollReveal>

        {/* Tabs */}
        <ScrollReveal delay={100}>
          <div className="flex flex-wrap gap-2 mb-12 border-b pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === cat.id
                    ? 'border-[hsl(220,50%,15%)] text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* Service items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeCategory.items.map((item, i) => (
            <ScrollReveal key={item.name} delay={i * 80}>
              <div className="p-6 border rounded-xl hover:border-foreground/20 transition-colors">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.tiers.map((tier) => (
                    <Badge key={tier} variant={tierBadges[tier]?.variant as 'default' | 'secondary' | 'outline' | 'destructive' ?? 'secondary'}>
                      {tierBadges[tier]?.label ?? tier}
                    </Badge>
                  ))}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{item.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
