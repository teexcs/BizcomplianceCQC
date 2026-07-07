'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';

const articles: Record<string, { title: string; date: string; readTime: string; content: string }> = {
  'gdpr-basics-small-business': {
    title: 'GDPR basics for small businesses',
    date: '2025-04-15',
    readTime: '8 min read',
    content: `
<p>The General Data Protection Regulation (GDPR) has been part of UK law since May 2018, supplemented by the Data Protection Act 2018. For small businesses, understanding what GDPR actually requires \u2014 as opposed to what the internet claims it requires \u2014 is essential.</p>

<h2>What GDPR actually says</h2>
<p>GDPR applies to any business that processes personal data. &ldquo;Personal data&rdquo; means any information relating to an identifiable living person. For most small businesses, this includes customer names, email addresses, phone numbers, and payment details.</p>

<h2>The six lawful bases</h2>
<p>Every time you process personal data, you must have a &ldquo;lawful basis&rdquo; for doing so. There are six to choose from:</p>

<p><strong>Consent</strong> \u2014 the individual has given clear permission. This must be freely given, specific, informed, and unambiguous. Pre-ticked boxes do not count.</p>

<p><strong>Contract</strong> \u2014 processing is necessary for a contract you have with the individual, or because they have asked you to take specific steps before entering into a contract.</p>

<p><strong>Legal obligation</strong> \u2014 processing is necessary for you to comply with the law. This does not include contractual obligations.</p>

<p><strong>Vital interests</strong> \u2014 processing is necessary to protect someone\u2019s life. Rarely relevant for businesses.</p>

<p><strong>Public task</strong> \u2014 processing is necessary for you to perform a task in the public interest. Rarely relevant for private businesses.</p>

<p><strong>Legitimate interests</strong> \u2014 processing is necessary for your legitimate interests or the legitimate interests of a third party, unless there is a good reason to protect the individual\u2019s personal data which overrides those legitimate interests.</p>

<h2>What small businesses actually need to do</h2>

<p><strong>1. Know what data you hold</strong>. Conduct a data audit. List every type of personal data you collect, where it came from, who you share it with, and how long you keep it.</p>

<p><strong>2. Have a privacy notice</strong>. This must be concise, transparent, intelligible, and easily accessible. It must tell people who you are, what you do with their data, and what rights they have.</p>

<p><strong>3. Secure the data</strong>. Implement appropriate technical and organisational measures. This does not mean enterprise-grade security \u2014 it means sensible measures proportionate to your risk.</p>

<p><strong>4. Have a process for Subject Access Requests</strong>. Individuals have the right to request a copy of their data. You must respond within one month.</p>

<p><strong>5. Know your breach reporting obligations</strong>. If personal data is lost, stolen, or accessed without authorisation, you may need to report it to the ICO within 72 hours.</p>

<h2>Common misconceptions</h2>

<p>\u201cI need consent for everything.\u201d No. Consent is just one of six lawful bases. For most customer data, &ldquo;contract&rdquo; or &ldquo;legitimate interests&rdquo; are more appropriate.</p>

<p>\u201cGDPR doesn\u2019t apply to small businesses.\u201d Wrong. GDPR applies to all businesses regardless of size, unless you are a pure domestic/household operation.</p>

<p>\u201cI can\u2019t store data outside the UK.\u201d Not quite right. You can transfer data internationally, but you need appropriate safeguards in place. The UK has adequacy decisions with the EU and several other countries.</p>

<h2>Penalties</h2>
<p>The ICO can fine up to \u00a317.5 million or 4% of global turnover (whichever is higher) for serious breaches. In practice, the ICO focuses on organisations that cause real harm through negligence. Small businesses that make genuine efforts to comply are unlikely to face significant fines.</p>

<p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>
    `,
  },
  'ico-registration-guide': {
    title: 'ICO registration: a step-by-step guide',
    date: '2025-04-10',
    readTime: '6 min read',
    content: `<p>Most UK businesses that process personal data must register with the Information Commissioner\u2019s Office (ICO) and pay a data protection fee. This guide explains whether you need to register, how to do it, and what happens if you don\u2019t.</p>
<h2>Do I need to register?</h2>
<p>You must register if you process personal data and you are not exempt. Exemptions are narrow and specific \u2014 most small businesses will need to register.</p>
<h2>How much does it cost?</h2>
<p>The fee depends on your size and turnover. Most small businesses fall into Tier 1 (\u00a340/year) or Tier 2 (\u00a360/year). The highest tier is \u00a32,900 for the largest organisations.</p>
<h2>How to register</h2>
<p>Registration is done online through the ICO website. You will need your company registration number (if applicable), your address, and details about the type of data processing you do.</p>
<p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>`,
  },
  'cookie-consent-explained': {
    title: 'Cookie consent: what the law actually says',
    date: '2025-04-05',
    readTime: '7 min read',
    content: `<p>The rules on cookies and similar technologies in the UK come from the Privacy and Electronic Communications Regulations (PECR), not GDPR. This distinction matters because the requirements are different.</p>
<h2>Essential vs non-essential cookies</h2>
<p>Essential cookies \u2014 those strictly necessary for the service explicitly requested by the user \u2014 do not require consent. Everything else does.</p>
<h2>What counts as consent?</h2>
<p>Consent under PECR must meet the GDPR standard: freely given, specific, informed, and unambiguous. This means no pre-ticked boxes, no scrolling as consent, and no bundling with terms of service.</p>
<p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>`,
  },
  'asa-advertising-rules': {
    title: 'ASA advertising rules for online businesses',
    date: '2025-03-28',
    readTime: '10 min read',
    content: `<p>The Advertising Standards Authority (ASA) enforces the UK Code of Non-broadcast Advertising and Direct & Promotional Marketing (CAP Code). Online advertising, including social media posts, is covered.</p>
<h2>Key principles</h2>
<p>All advertising must be legal, decent, honest, and truthful. Claims must be substantiated, pricing must be clear, and material information must not be omitted.</p>
<p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>`,
  },
  'subject-access-requests': {
    title: 'Handling Subject Access Requests',
    date: '2025-03-20',
    readTime: '9 min read',
    content: `<p>A Subject Access Request (SAR) is a request from an individual to see a copy of the personal data you hold about them. GDPR gives individuals this right, and you must respond within one month.</p>
<h2>Verifying identity</h2>
<p>You should verify the requester\u2019s identity before disclosing personal data. However, you must not ask for more information than necessary.</p>
<p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>`,
  },
  'companies-house-filing': {
    title: 'Companies House filing requirements',
    date: '2025-03-15',
    readTime: '7 min read',
    content: `<p>Every UK limited company must file certain documents with Companies House annually. Failure to file can result in penalties and ultimately strike-off.</p>
<h2>Confirmation statement</h2>
<p>You must file a confirmation statement at least once every 12 months, confirming that your company information is accurate and up to date.</p>
<h2>Annual accounts</h2>
<p>All companies must file annual accounts, even dormant ones. The deadline depends on whether you are filing your first accounts and whether you are using the accounting reference date.</p>
<p><em>BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.</em></p>`,
  },
};

export default function ResourceDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const article = articles[slug];

  if (!article) {
    return (
      <div className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-12 text-center">
          <h1 className="font-display text-3xl mb-4">Article not found</h1>
          <Link href="/resources" className="text-[hsl(220,45%,45%)] hover:underline">Back to resources</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="mb-12">
          <Link href="/resources" className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block">
            &larr; Back to resources
          </Link>
          <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground font-mono uppercase tracking-wider">
            <span>{new Date(article.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>&middot;</span>
            <span>{article.readTime}</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight">
            {article.title}
          </h1>
        </div>

        <article className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: article.content }} />

        <div className="mt-16 pt-8 border-t">
          <p className="text-xs text-muted-foreground">
            BizCompliance is a compliance system, not legal advice. For advice on your individual circumstances, instruct a regulated solicitor.
          </p>
        </div>
      </div>
    </div>
  );
}
