import { getEvidenceReviewQueues, getLibrary } from '@/lib/data/admin';
import { EvidenceReviewRow } from '@/components/admin/evidence-review-row';

export const dynamic = 'force-dynamic';

export default async function AdminEvidencePage() {
  const [{ pending, reviewed }, { areas }] = await Promise.all([getEvidenceReviewQueues(), getLibrary()]);
  const areaName = new Map(areas.map((a) => [a.code, a.name]));

  const toRow = (e: (typeof pending)[number]) => ({
    id: e.id,
    file_name: e.file_name,
    content_type: e.content_type,
    size_bytes: e.size_bytes,
    area_code: e.area_code,
    areaName: e.area_code ? (areaName.get(e.area_code) ?? null) : null,
    orgName: e.organisation?.name ?? 'Unknown client',
    scan_status: e.scan_status,
    review_status: e.review_status,
    reviewer_note: e.reviewer_note,
    created_at: e.created_at,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Evidence review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything clients upload lands here. Review it, note what it evidences, and flag gaps.
        </p>
      </div>

      <section>
        <h2 className="font-display text-lg tracking-tight mb-3">
          Awaiting review{' '}
          <span className="text-sm text-muted-foreground font-sans">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            Queue clear — new uploads appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((e) => (
              <EvidenceReviewRow key={e.id} row={toRow(e)} />
            ))}
          </ul>
        )}
      </section>

      {reviewed.length > 0 ? (
        <section>
          <h2 className="font-display text-lg tracking-tight mb-3">
            Reviewed{' '}
            <span className="text-sm text-muted-foreground font-sans">({reviewed.length})</span>
          </h2>
          <ul className="space-y-3">
            {reviewed.map((e) => (
              <EvidenceReviewRow key={e.id} row={toRow(e)} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
