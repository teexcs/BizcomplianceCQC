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
            Cookie policy
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: 1 May 2025</p>
        </div>
        <article className="prose prose-lg max-w-none">
          <p><strong>Last updated: 1 May 2025</strong></p>
<h2>What are cookies?</h2>
<p>Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to the site owners.</p>
<h2>How we use cookies</h2>
<p>Our website uses only essential cookies that are necessary for the site to function properly. These cookies do not collect personal information and cannot be disabled.</p>
<h2>Essential cookies we use</h2>
<ul>
<li><strong>Session cookie</strong> &mdash; maintains your session state as you navigate the site</li>
<li><strong>CSRF token</strong> &mdash; protects against cross-site request forgery attacks</li>
<li><strong>Preferences</strong> &mdash; remembers your display preferences</li>
</ul>
<h2>Third-party cookies</h2>
<p>We do not use any third-party cookies for analytics, advertising, or tracking purposes.</p>
<h2>Managing cookies</h2>
<p>You can manage cookies through your browser settings. However, disabling essential cookies may prevent our website from functioning correctly.</p>
          <p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>
        </article>
      </div>
    </div>
  );
}
