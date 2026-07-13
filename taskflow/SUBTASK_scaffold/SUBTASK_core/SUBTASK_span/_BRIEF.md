# Task: Source span/position helpers — `src/core/span.ts` + tests

**Slug**: `span` · **Task id**: `scaffold.core.span` · **Depends on**: — (none within
the subtree; the toolchain from `scaffold.tooling` is already on disk).
**Dependents**: `errors`, `synthesis` (and every later Klein stage that constructs spans).

## Objective
Implement the span/position construction and utility helpers that the whole Klein
pipeline builds source ranges with — thin, pure functions over the read-only
`contracts/tokens.ts` `Position`/`Span` shapes — plus unit tests proving them.

## Context
Part of the Klein `core` subtree (see `../_GLOBAL.md`). This is the precursor of
the core subtree: `errors` and later stages construct/merge `Span`s through these
helpers, so keep the surface small, total, and dependency-free (contracts only).

## Inputs (read at start)
- `../_GLOBAL.md` — subtree constraints (§4), import convention (§5), contract surface (§8).
- `../../_GLOBAL.md` (scaffold) and `../../../_GLOBAL.md` (project) — inherited constraints.
- `../../../contracts/tokens.ts` — the `Position` and `Span` shapes you build around
  (**import literally from `@contracts`; do not re-declare**).
- `../../SUBTASK_tooling/COMPLETE.md` §5 — the binding import/strictness conventions.

## Owned outputs (exclusive — write ONLY these)
- `src/core/span.ts` — pure helpers over `contracts/tokens.ts`. Suggested surface
  (finalize by what `errors`/downstream genuinely need; keep it minimal & total):
  - construct a `Position` and a `Span` (from two positions + a `source` name);
  - `mergeSpans(a, b)` → the smallest `Span` covering both (min start / max end),
    guarding a `source` mismatch sensibly;
  - a single-point / zero-width span helper for a `Position`;
  - small predicates/utilities actually needed downstream (e.g. span length,
    contains) — add only if used, no speculative surface.
  No `any` in the public surface. Everything immutable (`readonly` shapes preserved).
- `tests/core/span.test.ts` — Vitest unit tests: construction round-trips,
  `mergeSpans` (overlapping, disjoint, reversed order, identical), zero-width/point
  spans, and any predicates. Cover edge cases enough to clear the ≥90% bar on
  `src/core/span.ts` in isolation.

Write NOTHING outside those two paths. Do not modify `contracts/`, config, docs, or
any sibling's files.

## Success criteria
- `npm run build` (tsc strict) stays green with `span.ts` present; no `any` leak.
- `npm run lint` and `npm run format:check` pass on the two new files.
- `tests/core/span.test.ts` passes under `vitest run`; `src/core/span.ts` is ≥90%
  covered by these tests alone.
- Helpers are pure and total (no throw on ordinary inputs); shapes match
  `contracts/tokens.ts` exactly (no field drift).

## Constraints
- Import `Position`/`Span` from `@contracts` literally (`../_GLOBAL.md` §5); never
  paraphrase or re-declare them.
- Extensionless relative/`@contracts` imports; import the Vitest API explicitly.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. This is expected to be
genuinely atomic (one small module + its tests), but that judgement is yours.
