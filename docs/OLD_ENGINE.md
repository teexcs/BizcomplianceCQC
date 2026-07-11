# The old audit engine (archived)

This documents the **original** audit-matching engine that ran the workbench's
"Run engine" button until Stage 1 of the engine unification. It has been
retired in favour of the deterministic **policy-evidence-reader** engine
(`src/lib/engine/reader/`, a verbatim copy of the standalone tool). This file
exists so the history and reasoning aren't lost — as requested, the old system
is written down and separated out rather than silently deleted.

## What it was

A lightweight, fuzzy-matching engine made of two parts:

- **`src/lib/engine/matcher.ts`** — tokenised each evidence file's name/text and
  scored it against each checklist item (`matchEvidence`, `assignEvidence`).
  Matching was heuristic: token overlap + area hints, with a confidence number.
- **`src/lib/engine/autopilot.ts`** — orchestrated it:
  - `runAutopilotSuggest(auditId)` — scanned the whole vault, wrote a
    `suggested_status` / `suggested_evidence_id` / `suggestion_confidence` /
    `suggestion_reason` onto every undecided checklist item.
  - `suggestForNewEvidence(evidenceId)` — on each upload, ran the matcher for
    that one file to keep suggestions "warm" before a full run.
  - `runAutopilotApply(auditId)` — applied suggestions, RAG-rated every area,
    drafted findings for missing legal/CQC documents, cross-referenced SAF, and
    recomputed the readiness score.

## Why it was replaced

The matcher was **best-effort and untested**. It guessed with keyword overlap
and could neither quote its evidence nor prove a negative. That is not safe to
sell at £595. The `policy-evidence-reader` engine is **deterministic**: it reads
every line, and every "present" is a verbatim quote with a line number while
every "missing" is the plain absence of a pattern. Same files in ⇒ same result
out. It also catches un-customised templates, expired review dates, red flags
and unreadable files — none of which the old matcher did.

## What changed in the codebase (Stage 1 + 2)

- `engineSuggest` (the "Run engine" action) now calls
  **`runReaderSuggest`** in `src/lib/engine/reader/adapter.ts` — the reader,
  fed each file's already-extracted DB text, matching coverage against the live
  database library (146 documents today, and growing).
- **Removed** (dead once the reader took over): `runAutopilotSuggest` and
  `suggestForNewEvidence` from `autopilot.ts`, plus the on-upload matcher call in
  `src/lib/evidence/process.ts`. Suggestions now come from a single, deterministic
  "Run engine" pass rather than incremental keyword guesses.
- **Kept**: `runAutopilotApply` (renamed only in spirit — it is now the shared
  *apply → RAG → findings → score* pipeline that the reader's suggestions flow
  into). One brain decides; this turns decisions into the deliverable.

## Update: matcher.ts fully removed

`src/lib/audit/live-score.ts` (the continuous "current readiness" figure that
drifts on the client dashboard as documents age or are renewed) was migrated
onto the reader too, via `analyzeEvidenceByRef` in
`src/lib/engine/reader/adapter.ts`. `src/lib/engine/matcher.ts` had no remaining
callers and has been deleted. The client-visible live score and the admin's
formal audit engine now read documents the same, deterministic way — no more
split-brain between what the admin's engine finds and what the client's score
reflects.
