'use client';

import Link from 'next/link';

export default function LegalPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="mb-12">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block">
            &larr; Back to home
          </Link>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight">
            Accessibility statement
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: 1 May 2025</p>
        </div>
        <article className="prose prose-lg max-w-none">
          <p><strong>Last updated: 1 May 2025</strong></p>
<p>BizCompliance is committed to making our website accessible to everyone. We aim to comply with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.</p>
<h2>Our accessibility features</h2>
<ul>
<li>Keyboard navigation support throughout the site</li>
<li>Alt text on all images</li>
<li>Sufficient colour contrast (minimum 4.5:1)</li>
<li>Resizable text compatible with browser zoom</li>
<li>Clear, consistent navigation</li>
<li>Form labels and error messages</li>
</ul>
<h2>Known limitations</h2>
<p>Some older documents in our resource library may not be fully accessible. We are working to update these. Please contact us if you need an accessible version of any document.</p>
<h2>Feedback</h2>
<p>If you experience any accessibility barriers on our website, please contact us at hello@bizcompliance.co.uk. We welcome your feedback and will do our best to address any issues promptly.</p>
          <p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>
        </article>
      </div>
    </div>
  );
}
