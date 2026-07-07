import { FileDown, FolderLock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { getIssuedDocuments } from '@/lib/data/client';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const ctx = await requireOrgSession();
  const documents = await getIssuedDocuments(ctx.org.id);
  const current = documents.filter((d) => d.status === 'issued');
  const superseded = documents.filter((d) => d.status === 'superseded');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Document vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compliance documents issued to {ctx.org.name} by your auditor. Each carries a
          document-control block and a 12-month review cycle.
        </p>
      </div>

      {current.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <FolderLock className="mx-auto text-muted-foreground" size={40} aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No documents yet. Documents are issued to your vault after your readiness audit, or on
              request under your plan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ul className="divide-y">
              {current.map((d) => (
                <li key={d.id} className="py-4 flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Version {d.version} · Issued {formatDate(d.issued_at)}
                      {d.note ? ` · ${d.note}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">Current</Badge>
                  <a
                    href={`/api/files/download?type=document&id=${d.id}`}
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <FileDown size={14} aria-hidden="true" /> Download
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {superseded.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Superseded versions ({superseded.length})
          </summary>
          <Card className="mt-3">
            <CardContent className="pt-6">
              <ul className="divide-y">
                {superseded.map((d) => (
                  <li key={d.id} className="py-3 flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Version {d.version} · Issued {formatDate(d.issued_at)}
                      </p>
                    </div>
                    <a
                      href={`/api/files/download?type=document&id=${d.id}`}
                      className="text-xs text-[hsl(220,45%,45%)] hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </details>
      ) : null}
    </div>
  );
}
