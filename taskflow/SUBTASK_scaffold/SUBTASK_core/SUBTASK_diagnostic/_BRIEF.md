# Task: Diagnostic renderer — `src/core/diagnostic.ts` + tests

**Slug**: `diagnostic` · **Task id**: `scaffold.core.diagnostic` · **Depends on**: —
(none within the subtree; it consumes a `Diagnostic` + source string, not the error
classes). **Dependents**: `synthesis` (and the CLI/REPL that print diagnostics).

## Objective
Implement the `DiagnosticFormatter` from `contracts/errors.ts`: render a structured
`Diagnostic` + its source text into the human-readable, source-anchored snippet +
caret layout Klein shows users — plus unit tests proving the exact format. This is
a first-class product feature (excellent diagnostics), so invest in it.

## Context
Part of the Klein `core` subtree (see `../_GLOBAL.md`). Independent of `errors`: you
take a `Diagnostic` (already reduced) and the full `source` string, and produce a
string. You may reuse `span` helpers if genuinely useful, but your hard dependency
is `contracts/` only — so you run in parallel with `span`/`errors`.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree constraints (§4), import convention (§5), contract surface (§8).
- `../../../contracts/errors.ts` — **you implement `DiagnosticFormatter`**; also
  `Diagnostic`, `StackFrame`, `Severity`, `ErrorPhase`, `ErrorCode` (via `@contracts`).
  **Match the exact rendered layout shown in the `DiagnosticFormatter` docstring.**
- `../../../contracts/tokens.ts` — `Span`/`Position` (1-based line/column; column
  counts UTF-16 code units).
- `../../SUBTASK_tooling/COMPLETE.md` §5 — binding conventions.

## Owned outputs (exclusive — write ONLY these)
- `src/core/diagnostic.ts` — the `DiagnosticFormatter` implementation. It MUST
  reproduce the contract's layout, e.g.:
  ```
  error[E3001]: undefined variable 'foo'
   --> script.kl:3:9
    |
  3 |   let y = foo + 1;
    |           ^^^ not defined in this scope
  ```
  Handle: the `error[CODE]: message` header (severity-aware, `warning` too); the
  `--> source:line:col` locator from `span.start`; a line gutter aligned to the
  largest line number; the source snippet line(s); a caret run under the span
  columns (≥1 caret; clamp to line length); **multi-line spans** (sensible caret
  behavior across lines — at minimum underline the start line and indicate
  continuation); optional trailing runtime `stack` frames when `diagnostic.stack`
  is present; and an optional ANSI **color** mode via `options.color` (off by
  default — colorless output must remain the plain layout above). Guard against
  out-of-range/empty spans without throwing. No `any` in the public surface.
- `tests/core/diagnostic.test.ts` — Vitest unit tests asserting the **exact**
  rendered strings (colorless) for: a single-line span, a multi-line span, a
  zero-width/point caret, a span at line/column 1, a runtime diagnostic with a
  `stack`, and a `warning` severity. Add a color-on test that asserts ANSI codes
  are present (and absent when off). Key off `ErrorCode`/structure for inputs, not
  message wording of your own prose. Clear the ≥90% bar on `src/core/diagnostic.ts`.

Write NOTHING outside those two paths. Do not modify `contracts/`, config, docs, or
any sibling's files.

## Success criteria
- `npm run build`, `npm run lint`, `npm run format:check` green on the new files; no `any` leak.
- `tests/core/diagnostic.test.ts` passes under `vitest run`; `src/core/diagnostic.ts` ≥90% covered.
- Colorless output byte-matches the `contracts/errors.ts` layout; color mode adds
  ANSI without changing the textual structure; multi-line + edge cases handled
  without throwing.

## Constraints
- Implement `DiagnosticFormatter` literally from `@contracts`; do not re-declare
  contract types. Column math is 1-based, UTF-16 code units (per `Position`).
- Extensionless relative/`@contracts` imports; import the Vitest API explicitly.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. The renderer is the
substantial module of this subtree; if your reading finds it genuinely warrants
further split (e.g. snippet extraction vs. caret/color layout), that judgement is
yours — but it is expected to be a single, cohesive atomic task.
