import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bizcompliance.co.uk'),
  title: {
    default: 'BizCompliance CQC — One-off CQC readiness audits for care providers',
    template: '%s · BizCompliance CQC',
  },
  description:
    'Independent one-off CQC readiness audits for domiciliary care, supported living, care homes and healthcare providers. Clear risks, evidence gaps and action plans.',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'BizCompliance CQC',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className="antialiased">
        <div className="min-h-screen">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
