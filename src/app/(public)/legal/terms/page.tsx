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
            Terms of service
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: 1 May 2025</p>
        </div>
        <article className="prose prose-lg max-w-none">
          <p><strong>Last updated: 1 May 2025</strong></p>
<p>These terms of service govern your use of the BizCompliance CQC website and services. By using our services, you agree to these terms.</p>
<h2>1. Who we are</h2>
<p>BizCompliance CQC Ltd is an independent compliance audit service for care providers. We provide one-off CQC readiness audits and related support materials.</p>
<h2>2. Our services</h2>
<p>We provide manual CQC readiness audits, evidence reviews, risk-rated findings and a priority action plan. We are not the Care Quality Commission and do not guarantee inspection outcomes.</p>
<h2>3. What we do not do</h2>
<p>We do not provide legal advice, represent clients in legal proceedings, or guarantee specific outcomes from audit work. For legal advice on your individual circumstances, you should instruct a regulated solicitor.</p>
<h2>4. Payment</h2>
<p>The one-off CQC readiness audit is priced at £349 and must be paid in full before work begins.</p>
<h2>5. Intellectual property</h2>
<p>The compliance documents we create for you become your property upon full payment. We retain the right to use anonymised learning from our work to improve our services.</p>
<h2>6. Liability</h2>
<p>Our liability to you is limited to the amount you have paid us for the services in question. We are not liable for indirect, consequential, or economic loss.</p>
<h2>7. Confidentiality</h2>
<p>We treat all information you provide as confidential. We will not disclose your information to third parties except as necessary to provide our services or as required by law.</p>
<h2>8. Termination</h2>
<p>Either party may terminate services with written notice. Upon termination, you will retain access to documents already delivered.</p>
<h2>9. Governing law</h2>
<p>These terms are governed by English law. Any disputes will be subject to the exclusive jurisdiction of the English courts.</p>
<h2>10. Changes to these terms</h2>
<p>We may update these terms from time to time. We will notify you of significant changes by email.</p>
          <p><em>BizCompliance CQC is an independent compliance audit service, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>
        </article>
      </div>
    </div>
  );
}
