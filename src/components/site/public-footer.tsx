import Link from 'next/link';

const footerColumns = [
  {
    title: 'Audit',
    links: [
      { label: 'Who it’s for', href: '/#who' },
      { label: 'What’s included', href: '/#included' },
      { label: 'CQC areas', href: '/#areas' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy notice', href: '/legal/privacy' },
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Cookie policy', href: '/legal/cookies' },
      { label: 'Complaints procedure', href: '/legal/complaints' },
      { label: 'Accessibility statement', href: '/legal/accessibility' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="font-display text-xl font-semibold tracking-tight">
              BizCompliance CQC
            </Link>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Independent CQC readiness audits for care providers. One-off, manual and focused on inspection readiness.
            </p>
            <div className="mt-6 space-y-2 text-xs text-muted-foreground font-mono">
              <p>One-off audit only</p>
              <p>&pound;595 personalised readiness review</p>
              <p>United Kingdom</p>
            </div>
          </div>

          {/* Link columns */}
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-sm font-semibold tracking-tight mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} BizCompliance CQC Ltd. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground max-w-2xl md:text-right">
              Ready to tighten your evidence, reduce inspection-day guesswork and get a clear action plan fast? Start with the CQC Readiness Audit and turn uncertainty into a practical next step.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
