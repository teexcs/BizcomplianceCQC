'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, Quote, XCircle, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { getEvidenceTrust, getAuditDiff, type AuditDiff } from '@/lib/actions/engine';
import { buildBenchmark, VERDICT_LABEL } from '@/lib/audit/benchmark';
import type { EvidenceProof, ExecutionProof, Contradiction } from '@/lib/engine/reader/adapter';

/**
 * Evidence & execution — the founder's trust surface. Shows, per CQC area:
 *  • PROVEN signals with the verbatim quote + line from the client's own doc,
 *  • expected signals NOT found (named gaps), and
 *  • EXECUTION proof: policy claims cross-referenced to filled-in records,
 *    quoting the dated/signed line that shows the policy is actually done.
 * Nothing is asserted without a citation.
 */
export function EvidencePanel({ auditId }: { auditId: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<EvidenceProof | null>(null);
  const [execution, setExecution] = useState<ExecutionProof | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [diff, setDiff] = useState<AuditDiff | null>(null);

  function load() {
    setError(null);
    start(async () => {
      const [res, diffRes] = await Promise.all([getEvidenceTrust(auditId), getAuditDiff(auditId)]);
      if (!res.ok) {
        setError(res.error ?? 'Could not load the evidence view.');
        return;
      }
      setProof(res.proof ?? null);
      setExecution(res.execution ?? null);
      setContradictions(res.contradictions ?? []);
      setDiff(diffRes.ok ? diffRes.diff ?? null : null);
    });
  }

  const benchmark = proof
    ? buildBenchmark(
        proof.areas.map((a) => ({
          areaCode: a.areaCode,
          criticalProven: a.criticalProven,
          criticalTotal: a.criticalTotal,
        })),
      )
    : null;

  const execByArea = new Map((execution?.areas ?? []).map((a) => [a.areaCode, a]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">
            <ShieldCheck size={15} className="mr-1.5 -mt-0.5 inline" aria-hidden="true" />
            Evidence &amp; execution proof
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every claim is backed by a verbatim quote from the client&apos;s own documents. Nothing is
            asserted without a line to point to.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {busy ? 'Reading documents…' : proof ? 'Refresh' : 'Show evidence proof'}
        </button>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {proof ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Signals proven" value={`${proof.totalProven}`} />
          <Stat label="Critical proven" value={`${proof.totalCriticalProven}/${proof.totalCritical}`} />
          <Stat
            label="Execution confirmed"
            value={execution ? `${execution.totalConfirmed}/${execution.totalClaims}` : '—'}
          />
        </div>
      ) : null}

      {diff?.hasPrevious ? (
        <section className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm font-medium">
            Since the last audit
            {diff.scoreDelta != null ? (
              <span className={diff.scoreDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
                {' '}· score {diff.scoreDelta >= 0 ? '+' : ''}
                {diff.scoreDelta} ({diff.previousScore} → {diff.currentScore})
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {diff.closed.length} gap{diff.closed.length === 1 ? '' : 's'} closed · {diff.regressed.length}{' '}
            regressed · {diff.newGaps.length} new gap{diff.newGaps.length === 1 ? '' : 's'}
          </p>
          {diff.regressed.length > 0 ? (
            <p className="mt-1 text-[11px] text-amber-400">
              Regressed: {diff.regressed.slice(0, 4).map((r) => r.title).join(', ')}
              {diff.regressed.length > 4 ? '…' : ''}
            </p>
          ) : null}
        </section>
      ) : null}

      {benchmark && benchmark.areas.length > 0 ? (
        <section className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm font-medium">
            Benchmark — {benchmark.aboveCount} area{benchmark.aboveCount === 1 ? '' : 's'} above a typical
            provider, {benchmark.belowCount} below
          </p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {benchmark.areas.map((a) => (
              <div key={a.areaCode} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  {a.areaCode} {a.areaName}
                </span>
                <span
                  className={
                    a.verdict === 'above'
                      ? 'text-green-400'
                      : a.verdict === 'below'
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                  }
                >
                  {Math.round(a.coverage * 100)}% · {VERDICT_LABEL[a.verdict]}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {contradictions.length > 0 ? (
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(4,70%,55%)]">
            <AlertTriangle size={15} aria-hidden="true" /> Internal inconsistencies ({contradictions.length})
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Different documents state different frequencies for the same thing — inspectors probe
            this. Reconcile before delivery.
          </p>
          <ul className="mt-2 space-y-2">
            {contradictions.map((c) => (
              <li key={c.topic} className="rounded-lg bg-card px-3 py-2">
                <p className="text-xs font-medium capitalize">{c.topic}</p>
                {c.statements.map((s, i) => (
                  <p key={i} className="mt-0.5 pl-3 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{s.value}</span> — &ldquo;{s.quote}&rdquo;{' '}
                    <span className="text-muted-foreground/70">
                      ({s.fileName}, line {s.line})
                    </span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {proof
        ? proof.areas.map((area) => {
            const exec = execByArea.get(area.areaCode);
            return (
              <section key={area.areaCode} className="rounded-xl border border-border bg-card">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold">
                    {area.areaCode} {area.areaName}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {area.criticalProven}/{area.criticalTotal} critical signals proven
                    {area.files.length ? ` · ${area.files.length} doc(s)` : ''}
                  </span>
                </header>

                <div className="space-y-3 px-4 py-3">
                  {/* Proven signals with quotes */}
                  {area.proven.length > 0 ? (
                    <div className="space-y-2">
                      {area.proven.map((p) => (
                        <div key={p.label} className="rounded-lg bg-green-500/5 px-3 py-2">
                          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-green-300">
                            <CheckCircle2 size={13} aria-hidden="true" />
                            {p.label}
                            {p.weight === 'critical' ? (
                              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] uppercase">
                                critical
                              </span>
                            ) : null}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                                p.confidence.level === 'strong'
                                  ? 'bg-green-500/15 text-green-300'
                                  : p.confidence.level === 'moderate'
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-red-500/15 text-red-300'
                              }`}
                              title={p.confidence.reason}
                            >
                              {p.confidence.level} · {p.confidence.matchCount} match
                              {p.confidence.matchCount === 1 ? '' : 'es'}
                            </span>
                          </p>
                          {p.citations.slice(0, 2).map((c, i) => (
                            <p key={i} className="mt-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                              <Quote size={10} className="mr-1 -mt-0.5 inline" aria-hidden="true" />
                              &ldquo;{c.quote}&rdquo;{' '}
                              <span className="text-muted-foreground/70">
                                — {c.fileName} (line {c.line})
                              </span>
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Not-found gaps */}
                  {area.notFound.length > 0 ? (
                    <div className="rounded-lg bg-red-500/5 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-[hsl(4,70%,55%)]">
                        <XCircle size={13} aria-hidden="true" /> Expected but not found
                      </p>
                      <ul className="mt-1 space-y-0.5 pl-4">
                        {area.notFound.map((n) => (
                          <li key={n.label} className="text-[11px] text-muted-foreground">
                            {n.label}
                            {n.weight === 'critical' ? (
                              <span className="ml-1.5 text-[hsl(4,70%,55%)]">(critical)</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Execution proof: claim → record */}
                  {exec && exec.claims.length > 0 ? (
                    <div className="rounded-lg border border-border/70 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium">
                        <FileText size={13} aria-hidden="true" /> Is it being done? (policy → record)
                        <span className="text-muted-foreground">
                          {exec.confirmed}/{exec.total} confirmed
                        </span>
                      </p>
                      <ul className="mt-1.5 space-y-1.5">
                        {exec.claims.slice(0, 8).map((c, i) => (
                          <li key={i} className="text-[11px] leading-relaxed">
                            <span className="text-foreground">{c.claim}</span>
                            {c.state === 'confirmed' && c.evidence ? (
                              <span className="block pl-3 text-green-300">
                                ✓ Confirmed: &ldquo;{c.evidence.quote}&rdquo; — {c.evidence.fileName} (line{' '}
                                {c.evidence.line})
                              </span>
                            ) : (
                              <span className="block pl-3 text-amber-400">
                                <AlertTriangle size={10} className="mr-1 -mt-0.5 inline" aria-hidden="true" />
                                Claimed in policy, no supporting record supplied — verify by sampling.
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {exec.recordFiles.length > 0 ? (
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          Records checked: {exec.recordFiles.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No filled-in records found for this area — execution can only be confirmed by
                      sampling actual records (training matrix, MAR charts, care files).
                    </p>
                  )}
                </div>
              </section>
            );
          })
        : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-lg tabular-nums">{value}</p>
    </div>
  );
}
