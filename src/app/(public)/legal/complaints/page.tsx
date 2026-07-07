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
            Complaints procedure
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: 1 May 2025</p>
        </div>
        <article className="prose prose-lg max-w-none">
          <p><strong>Last updated: 1 May 2025</strong></p>
<p>We are committed to providing a high-quality service. If you are dissatisfied with any aspect of our service, we want to hear from you.</p>
<h2>How to make a complaint</h2>
<p>You can make a complaint by:</p>
<ul>
<li>Emailing hello@bizcompliance.co.uk with &ldquo;Complaint&rdquo; in the subject line</li>
<li>Writing to us at 12 Farringdon Road, London EC1M 3EN</li>
</ul>
<h2>What happens next</h2>
<p><strong>Acknowledgement:</strong> We will acknowledge your complaint within 2 working days.</p>
<p><strong>Investigation:</strong> We will investigate your complaint and aim to provide a full response within 10 working days.</p>
<p><strong>Resolution:</strong> If we cannot resolve your complaint within this timeframe, we will explain why and give you a revised timeframe.</p>
<h2>Escalation</h2>
<p>If you are not satisfied with our response, you may escalate your complaint to the Legal Ombudsman. The Legal Ombudsman can investigate complaints about compliance services. You must contact the Legal Ombudsman within six months of our final response.</p>
<p>Legal Ombudsman contact details:<br/>
PO Box 6806, Wolverhampton WV1 9WJ<br/>
Tel: 0300 555 0333<br/>
Email: enquiries@legalombudsman.org.uk</p>
          <p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>
        </article>
      </div>
    </div>
  );
}
