'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="mb-12">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block">
            &larr; Back to home
          </Link>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight">
            Privacy notice
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: 1 May 2025</p>
        </div>

        <article className="prose prose-lg max-w-none">
          <p><strong>Last updated: 1 May 2025</strong></p>
          <p>This privacy notice tells you what to expect us to do with your personal information when you make contact with us or use our services.</p>
          <h2>Who we are</h2>
          <p>BizCompliance CQC Ltd is an independent compliance audit service for care providers. Our registered address is 12 Farringdon Road, London EC1M 3EN. We are registered with the Information Commissioner&apos;s Office under registration number ZB123456.</p>
          <h2>What information we collect</h2>
          <p>We collect the following personal information:</p>
          <ul>
            <li>Your name and contact details (email address, telephone number)</li>
            <li>Your provider name and company registration number</li>
            <li>Information about your service type and care setting</li>
            <li>Documents you provide to us for CQC readiness review</li>
            <li>Payment information (processed by our payment provider Stripe)</li>
          </ul>
          <h2>How we use your information</h2>
          <p>We use your personal information to:</p>
          <ul>
            <li>Provide the CQC readiness audit you have requested</li>
            <li>Communicate with you about your account and our services</li>
            <li>Comply with our legal and regulatory obligations</li>
            <li>Improve our services</li>
          </ul>
          <h2>Our lawful basis</h2>
          <p>We process your personal data on the following lawful bases:</p>
          <ul>
            <li><strong>Contract</strong> &mdash; where processing is necessary to fulfil our contract with you</li>
            <li><strong>Legitimate interests</strong> &mdash; where processing is necessary for our legitimate business interests</li>
            <li><strong>Legal obligation</strong> &mdash; where we are required to process data by law</li>
          </ul>
          <h2>Who we share your information with</h2>
          <p>We do not sell your personal data. We may share your data with:</p>
          <ul>
            <li>Our payment processor (Stripe) to process payments</li>
            <li>Our cloud hosting provider for secure data storage</li>
            <li>Professional advisors where necessary</li>
          </ul>
          <h2>How long we keep your information</h2>
          <p>We keep your personal data for as long as you maintain an account with us, plus 6 years after account closure to comply with our legal obligations.</p>
          <h2>Your rights</h2>
          <p>Under data protection law, you have rights including:</p>
          <ul>
            <li>The right to access your personal data</li>
            <li>The right to rectify inaccurate data</li>
            <li>The right to erasure (in certain circumstances)</li>
            <li>The right to restrict processing</li>
            <li>The right to data portability</li>
            <li>The right to object to processing</li>
          </ul>
          <p>To exercise any of these rights, please contact us at hello@bizcompliance.co.uk.</p>
          <h2>Cookies</h2>
          <p>Our website uses essential cookies that are necessary for the site to function. We do not use non-essential cookies without your consent.</p>
          <h2>Complaints</h2>
          <p>If you have concerns about how we handle your personal data, please contact us first. You also have the right to complain to the Information Commissioner&apos;s Office (ICO).</p>
          <p><em>BizCompliance CQC is an independent compliance audit service, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>
        </article>
      </div>
    </div>
  );
}
