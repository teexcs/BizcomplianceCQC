import { getLibrary, getOrganisations } from '@/lib/data/admin';
import { LibraryBrowser } from '@/components/admin/library-browser';

export const dynamic = 'force-dynamic';

export default async function AdminLibraryPage() {
  const [{ areas, assets }, organisations] = await Promise.all([getLibrary(), getOrganisations()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Compliance library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your {assets.length}-document master library across {areas.length} areas. Select documents
          and issue them to a client&apos;s vault — clients only ever see what you issue.
        </p>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
          <p className="text-sm font-medium">Library not seeded yet</p>
          <p className="text-sm text-muted-foreground">
            Run <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">npm run seed:library</code>{' '}
            after applying the database migrations — see SETUP.md.
          </p>
        </div>
      ) : (
        <LibraryBrowser
          areas={areas}
          assets={assets}
          organisations={organisations.map((o) => ({ id: o.id, name: o.name }))}
        />
      )}
    </div>
  );
}
