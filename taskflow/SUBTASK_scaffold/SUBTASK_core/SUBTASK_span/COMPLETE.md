# COMPLETE — `scaffold.core.span` (Klein source span/position helpers)

**Task**: Implement the span/position construction & utility helpers the whole
Klein pipeline builds source ranges with, plus unit tests. **Decompose
evaluation**: Atomic (one module + its tests — a single responsibility: span
geometry). **Status**: COMPLETED.

Every success criterion below was **proven by running the real toolchain command**
(Node v24.18.0), not asserted.

---

## 1. Owned outputs delivered (exclusive — only these two paths)

| File | Role |
|---|---|
| `src/core/span.ts` | Pure, total helpers over the read-only `contracts/tokens.ts` `Position`/`Span` shapes |
| `tests/core/span.test.ts` | Vitest unit tests (14 cases) covering the module in isolation |

Wrote **nothing** outside those two paths. Did not modify `contracts/`, any
config/CI file, docs, or any sibling's files.

## 2. Public surface (finalized minimal & total — no speculative API)

Types imported literally: `import type { Position, Span } from "@contracts";`
(never re-declared; `import type` satisfies `consistent-type-imports`).

| Export | Signature | Semantics |
|---|---|---|
| `makePosition` | `(offset, line, column) => Position` | Pure record constructor (0-based offset, 1-based line/col) |
| `makeSpan` | `(start, end, source) => Span` | Half-open `[start, end)` span in `source`; no reordering |
| `pointSpan` | `(at, source) => Span` | Zero-width span (`start === end`) for caret-only diagnostics (e.g. EOF) |
| `mergeSpans` | `(a, b) => Span` | Smallest range covering both: earlier `start`, later `end` (by `offset`); order-insensitive |
| `spanLength` | `(span) => number` | `end.offset - start.offset` (UTF-16 code units); `0` for a point span |

Design choices (documented, not confabulated):
- **All functions are total** — no throw on ordinary inputs. A reversed range
  yields a negative `spanLength` rather than an exception; `makeSpan` preserves
  caller ordering (use `mergeSpans` when order is unknown).
- **`mergeSpans` source-mismatch guard**: merging is only meaningful within one
  source, so `a.source` is kept deterministically when the two differ (sensible,
  documented, total — rather than throwing). Verified by test.
- **Immutability preserved**: only reads the `readonly` contract shapes and
  returns fresh conforming literals; `mergeSpans` reuses the existing (immutable)
  `Position` objects for the chosen bounds.
- **No `any`** anywhere in the surface.

## 3. Proof the gate is green (commands actually run)

```
npm run build                                 -> exit 0  (tsc -p tsconfig.build.json, strict; span.ts present)
npx eslint src/core/span.ts tests/core/span.test.ts   -> exit 0
npx prettier --check <both files>             -> exit 0  ("All matched files use Prettier code style!")
npx vitest run --coverage tests/core/span.test.ts     -> exit 0  (14 passed)
```

Coverage on `src/core/span.ts` **in isolation** (only module under `src/` so far):

```
Statements : 100% (21/21)   Branches : 100% (9/9)
Functions  : 100% (5/5)     Lines    : 100% (21/21)
```

≥90% bar cleared on all four metrics (100%).

## 4. Conventions followed (from `../_GLOBAL.md` §5 / tooling `COMPLETE.md` §5)

- `@contracts` alias for contract types; **extensionless** relative import of the
  module-under-test from the test (`../../src/core/span`).
- Vitest API imported explicitly (`import { describe, it, expect } from "vitest"`
  — no globals).
- Strict flags all honored; discriminated-union/exhaustive-switch machinery not
  needed here (no branching on `ErrorPhase`/`ErrorCode`/token kinds in this module).

## 5. How this composes downstream (handoff)

`scaffold.core.errors` and every later stage construct/merge `Span`s through
these helpers instead of hand-rolling range math:
- Grow a token range as a stage consumes tokens: `mergeSpans(first.span, last.span)`.
- Point at end-of-input / a missing token: `pointSpan(pos, source)`.
- `spanLength` supports snippet/caret width in the diagnostic renderer.

The surface is intentionally small; if a downstream consumer needs an additional
total predicate (e.g. `contains`), it is a trivial additive extension here — none
was added speculatively per the brief.

## 6. Success criteria — all met

- [x] `npm run build` (tsc strict) green with `span.ts` present; no `any` leak.
- [x] `npm run lint` and `npm run format:check` pass on the two new files.
- [x] `tests/core/span.test.ts` passes under `vitest run`; `src/core/span.ts`
      is 100% covered by these tests alone (≥90% bar).
- [x] Helpers pure & total; shapes match `contracts/tokens.ts` exactly (no drift).
- [x] `contracts/` unmodified; wrote only the two owned files.
