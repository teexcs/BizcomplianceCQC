import 'server-only';

const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#111722;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e0d3;">
          <tr>
            <td style="background:#111a2c;padding:22px 32px;">
              <span style="color:#e6d3a6;font-size:18px;font-weight:bold;letter-spacing:.4px;">BizCompliance</span>
              <span style="color:#8b93a3;font-size:12px;display:block;margin-top:2px;">CQC compliance, handled properly</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#111722;">${title}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #eee5d4;color:#7a7f8c;font-size:12px;line-height:1.6;">
              BizCompliance · CQC readiness audits &amp; compliance support for care providers.<br/>
              You are receiving this because you have a BizCompliance account.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const p = (text: string) =>
  `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#333a47;">${text}</p>`;

const button = (href: string, label: string) =>
  `<p style="margin:22px 0;"><a href="${href}" style="background:#b8934a;color:#111722;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:8px;display:inline-block;">${label}</a></p>`;

export function welcomeEmail(businessName: string) {
  return {
    subject: 'Welcome to BizCompliance',
    html: layout(
      `Welcome, ${escapeHtml(businessName)}`,
      p('Your workspace is ready. The fastest route to inspection readiness is a one-off CQC Readiness Audit — a manual review of your evidence across all 18 compliance areas.') +
        p('Once purchased, you can upload evidence straight into your secure vault and track progress from your dashboard.') +
        button(`${SITE_URL()}/dashboard`, 'Open your dashboard'),
    ),
  };
}

export function auditPurchasedEmail(businessName: string) {
  return {
    subject: 'Your CQC Readiness Audit has started',
    html: layout(
      'Your audit is underway',
      p(`Thank you, ${escapeHtml(businessName)}. Your CQC Readiness Audit has been created and added to our review pipeline.`) +
        p('Next step: upload your policies, registers and evidence to your vault so the review can begin. The more complete your evidence, the sharper the findings.') +
        button(`${SITE_URL()}/dashboard/requests`, 'Upload evidence'),
    ),
  };
}

export function auditPurchasedAdminEmail(businessName: string, orgId: string) {
  return {
    subject: `New audit purchased — ${businessName}`,
    html: layout(
      'New audit in the pipeline',
      p(`${escapeHtml(businessName)} has purchased a CQC Readiness Audit.`) +
        p(`Organisation ID: ${orgId}`) +
        button(`${SITE_URL()}/admin/audits`, 'Open audit pipeline'),
    ),
  };
}

export function reportPublishedEmail(businessName: string, score: number) {
  return {
    subject: 'Your CQC readiness report is ready',
    html: layout(
      'Your audit report is ready',
      p(`${escapeHtml(businessName)}, your CQC Readiness Audit is complete.`) +
        p(`<strong>Readiness score: ${score}/100.</strong> Your report includes red / amber / green findings for each compliance area and a priority action plan.`) +
        button(`${SITE_URL()}/dashboard`, 'View your report'),
    ),
  };
}

export function documentsIssuedEmail(businessName: string, count: number) {
  return {
    subject: `${count} compliance ${count === 1 ? 'document' : 'documents'} issued to your vault`,
    html: layout(
      'New documents in your vault',
      p(`${escapeHtml(businessName)}, ${count === 1 ? 'a new compliance document has' : `${count} new compliance documents have`} been issued to your document vault.`) +
        button(`${SITE_URL()}/dashboard/documents`, 'Open document vault'),
    ),
  };
}

export function requestUpdateEmail(businessName: string, requestType: string, status: string) {
  return {
    subject: `Request update: ${requestType}`,
    html: layout(
      'Your request has been updated',
      p(`${escapeHtml(businessName)}, your request "${escapeHtml(requestType)}" is now <strong>${escapeHtml(status)}</strong>.`) +
        button(`${SITE_URL()}/dashboard/requests`, 'View request'),
    ),
  };
}

export function contactNotificationEmail(name: string, email: string, subject: string, message: string) {
  return {
    subject: `Contact form: ${subject}`,
    html: layout(
      'New contact form message',
      p(`<strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;`) +
        p(`<strong>Subject:</strong> ${escapeHtml(subject)}`) +
        p(escapeHtml(message).replace(/\n/g, '<br/>')),
    ),
  };
}

export function subscriptionStartedEmail(businessName: string, planName: string) {
  return {
    subject: `Your ${planName} plan is active`,
    html: layout(
      'Subscription confirmed',
      p(`${escapeHtml(businessName)}, your <strong>${escapeHtml(planName)}</strong> plan is now active.`) +
        p('Your compliance calendar, alerts and document vault are live in your dashboard.') +
        button(`${SITE_URL()}/dashboard`, 'Open your dashboard'),
    ),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
