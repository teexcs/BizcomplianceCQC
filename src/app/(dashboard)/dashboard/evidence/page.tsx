import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { getEvidenceFiles } from '@/lib/data/client';
import { getVaultCoverage } from '@/lib/engine/reader/adapter';
import { EvidenceUploader } from '@/components/dashboard/evidence-uploader';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function bucketLabel(areaCode: string | null): string {
  if (!areaCode) return 'Unsorted';
  if (['01', '09', '10', '17'].includes(areaCode)) return 'Policies & governance';
  if (['11', '12'].includes(areaCode)) return 'People & training';
  if (['02', '03', '04', '18'].includes(areaCode)) return 'Care planning & safeguarding';
  if (['05', '14', '15', '16'].includes(areaCode)) return 'Safety & incidents';
  if (['06'].includes(areaCode)) return 'Medicines & clinical';
  if (['08'].includes(areaCode)) return 'Complaints & feedback';
  if (['13'].includes(areaCode)) return 'Data & privacy';
  return 'Other';
}

function ageDays(date: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

function ageLabel(date: string): string {
  const days = ageDays(date);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

export default async function EvidencePage() {
  const ctx = await requireOrgSession();
  const [files, coverage] = await Promise.all([
    getEvidenceFiles(ctx.org.id),
    getVaultCoverage(ctx.org.id),
  ]);
  const currentFiles = files.filter((f) => f.lifecycle_state !== 'superseded');
  const supersededFiles = files.filter((f) => f.lifecycle_state === 'superseded');
  const coveragePct =
    coverage.libraryTotal > 0 ? Math.round((coverage.matched / coverage.libraryTotal) * 100) : 0;
  const unsorted = currentFiles.filter((f) => !f.area_code);
  const pending = currentFiles.filter((f) => f.review_status === 'pending');
  const reviewed = currentFiles.filter((f) => f.review_status === 'reviewed');
  const flagged = currentFiles.filter((f) => f.review_status === 'flagged');
  const stalePending = pending.filter((f) => ageDays(f.created_at) >= 7);
  const recentUploads = [...currentFiles].slice(0, 5);
  const grouped = Object.entries(
    currentFiles.reduce<Record<string, typeof currentFiles>>((acc, file) => {
      const key = bucketLabel(file.area_code);
      acc[key] = acc[key] ?? [];
      acc[key].push(file);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-8">
      <div className="space-y-4 border-b border-border/70 pb-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl tracking-tight">Evidence vault</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload your policies, registers, audits and records here. Each upload fills the
            progress bar so you can see the dashboard move forward.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="border border-border/70 bg-background px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Queue</p>
            <p className="mt-1 text-sm font-medium">Upload everything in one place</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Policies, registers, training, certificates and supporting evidence all land in one
              organised queue.
            </p>
          </div>
          <div className="border border-border/70 bg-background px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">System</p>
            <p className="mt-1 text-sm font-medium">We sort it into areas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-detected files are grouped by CQC area and anything unclear stays unsorted for
              review.
            </p>
          </div>
          <div className="border border-border/70 bg-background px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Review</p>
            <p className="mt-1 text-sm font-medium">Admin review picks it up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Everything appears in the admin queue, and stale uploads are chased automatically.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-none border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current</p>
            <p className="mt-1 text-2xl font-display">{currentFiles.length}</p>
          </div>
          <div className="rounded-none border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-display">{pending.length}</p>
          </div>
          <div className="rounded-none border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Reviewed</p>
            <p className="mt-1 text-2xl font-display">{reviewed.length}</p>
          </div>
          <div className="rounded-none border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">History</p>
            <p className="mt-1 text-2xl font-display">{supersededFiles.length}</p>
          </div>
        </div>

        {flagged.length ? (
          <div className="rounded-none border border-red-500/30 bg-red-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Needs attention</p>
                <p className="text-xs text-muted-foreground">
                  {flagged.length} file{flagged.length === 1 ? '' : 's'} have been flagged by admin.
                </p>
              </div>
              <Badge className="bg-red-500/15 text-red-700">{flagged.length} flagged</Badge>
            </div>
          </div>
        ) : null}

        <div className="rounded-none border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Library coverage</p>
            <p className="text-xs text-muted-foreground">
              Matched automatically against the {coverage.libraryTotal}-document compliance library
            </p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-[hsl(220,50%,15%)] transition-all"
              style={{ width: `${Math.max(coveragePct, coverage.matched > 0 ? 2 : 0)}%` }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-lg font-display leading-none">
                {coverage.matched}
                <span className="text-sm text-muted-foreground">/{coverage.libraryTotal}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">library documents matched</p>
            </div>
            <div>
              <p className="text-lg font-display leading-none">
                {coverage.legalMatched}
                <span className="text-sm text-muted-foreground">/{coverage.legalTotal}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">legally-required documents</p>
            </div>
            <div>
              <p className="text-lg font-display leading-none">
                {coverage.areasCovered}
                <span className="text-sm text-muted-foreground">/{coverage.areasTotal}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">CQC areas with evidence</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            You don&apos;t need everything before your audit — we review whatever is here and flag
            every gap CQC might. Anything missing becomes your priority action plan.
            {coverage.unreadableFiles > 0
              ? ` ${coverage.unreadableFiles} file${coverage.unreadableFiles === 1 ? '' : 's'} (scans/images) can't be machine-read and will be reviewed by your auditor directly.`
              : ''}
          </p>
        </div>

        {stalePending.length ? (
          <div className="rounded-none border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
              <p className="text-sm font-medium">Needs chase</p>
              <p className="text-xs text-muted-foreground">
                {stalePending.length} upload{stalePending.length === 1 ? '' : 's'} have been waiting
                7+ days.
              </p>
              </div>
              <Badge className="bg-amber-500/15 text-amber-700">{stalePending.length} stale</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {stalePending.slice(0, 4).map((file) => (
                <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {bucketLabel(file.area_code)} · {ageLabel(file.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">Chase</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {recentUploads.length ? (
          <div className="rounded-none border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Latest uploads</p>
                <p className="text-xs text-muted-foreground">A quick view of the newest files.</p>
              </div>
              <Badge variant="outline">{recentUploads.length}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {recentUploads.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {bucketLabel(file.area_code)} · {formatDate(file.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">{file.review_status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <EvidenceUploader />
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">Current unsorted files</h2>
              <span className="text-xs text-muted-foreground">{unsorted.length} files</span>
            </div>
            {unsorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing left unfiled.</p>
            ) : (
              <ul className="divide-y border-y border-border/70">
                {unsorted.map((f) => (
                  <li key={f.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(f.size_bytes)} · {formatDate(f.created_at)} · {ageLabel(f.created_at)}
                      </p>
                    </div>
                    <Badge variant="outline">Unsorted</Badge>
                    <a
                      href={`/api/files/download?type=evidence&id=${f.id}`}
                      className="text-xs text-[hsl(220,45%,45%)] hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">Organised by file type</h2>
              <span className="text-xs text-muted-foreground">{grouped.length} groups</span>
            </div>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Uploads will be grouped here when a file type is selected or the system can sort it.
              </p>
            ) : (
              <ul className="divide-y border-y border-border/70">
                {grouped.map(([label, items]) => {
                  const latest = items[0];
                  return (
                    <li key={label} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {items.length} file{items.length === 1 ? '' : 's'} · latest{' '}
                          {formatDate(latest.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{items.length}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight">All current evidence</h2>
            <span className="text-xs text-muted-foreground">{currentFiles.length} files</span>
          </div>
          {currentFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing uploaded yet - start with your Statement of Purpose, safeguarding policy and
              staff training matrix.
            </p>
          ) : (
            <ul className="divide-y border-y border-border/70">
              {currentFiles.map((f) => (
                <li key={f.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {bucketLabel(f.area_code)} · {formatSize(f.size_bytes)} · {formatDate(f.created_at)} ·{' '}
                      {ageLabel(f.created_at)}
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
                    className="text-xs text-[hsl(220,45%,45%)] hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {supersededFiles.length ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">Evidence history</h2>
              <span className="text-xs text-muted-foreground">{supersededFiles.length} superseded</span>
            </div>
            <ul className="divide-y border-y border-border/70">
              {supersededFiles.map((f) => (
                <li key={f.id} className="py-3 flex flex-wrap items-center gap-3 opacity-80">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {bucketLabel(f.area_code)} · superseded · {formatDate(f.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">History</Badge>
                  <a
                    href={`/api/files/download?type=evidence&id=${f.id}`}
                    className="text-xs text-[hsl(220,45%,45%)] hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
