import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { getEvidenceFiles, getLibraryAreas } from '@/lib/data/client';
import { EvidenceUploader } from '@/components/dashboard/evidence-uploader';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function EvidencePage() {
  const ctx = await requireOrgSession();
  const [files, areas] = await Promise.all([
    getEvidenceFiles(ctx.org.id),
    getLibraryAreas(),
  ]);
  const areaName = new Map(areas.map((a) => [a.code, a.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Evidence vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your policies, registers, audits and records here. Your auditor reviews everything
          you upload as part of your CQC readiness assessment.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <EvidenceUploader areas={areas.map((a) => ({ code: a.code, name: a.name }))} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg tracking-tight">Uploaded evidence</h2>
            <span className="text-xs text-muted-foreground">{files.length} files</span>
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing uploaded yet — start with your Statement of Purpose, safeguarding policy and
              staff training matrix.
            </p>
          ) : (
            <ul className="divide-y">
              {files.map((f) => (
                <li key={f.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.area_code
                        ? `${f.area_code} ${areaName.get(f.area_code) ?? ''} · `
                        : ''}
                      {formatSize(f.size_bytes)} · {formatDate(f.created_at)}
                    </p>
                  </div>
                  {f.review_status === 'reviewed' ? (
                    <Badge className="bg-green-100 text-green-800">Reviewed</Badge>
                  ) : f.review_status === 'flagged' ? (
                    <Badge className="bg-red-100 text-red-800">Needs attention</Badge>
                  ) : (
                    <Badge variant="outline">Awaiting review</Badge>
                  )}
                  <a
                    href={`/api/files/download?type=evidence&id=${f.id}`}
                    className="text-xs text-[hsl(36,45%,45%)] hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
