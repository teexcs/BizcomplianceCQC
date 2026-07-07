import { PublicHeader } from '@/components/site/public-header';
import { PublicFooter } from '@/components/site/public-footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1 pt-16 md:pt-20">{children}</main>
      <PublicFooter />
    </div>
  );
}
