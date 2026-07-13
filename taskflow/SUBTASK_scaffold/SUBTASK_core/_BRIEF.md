# Task: Shared runtime core — `src/core/` + its unit tests

**Slug**: `core` · **Depends on**: `tooling` · **Dependents**: `verify`, and every
later pipeline stage (they import `src/core/` for errors, spans, diagnostics).

## Objective
Implement the shared runtime core that every Klein pipeline stage imports: source
span/position helpers, the concrete error classes implementing
`contracts/errors.ts#KleinError`, and the diagnostic renderer — plus unit tests
proving them.

## Context
Part of the Klein `scaffold` subtree (see `../_GLOBAL.md`). The `tooling` task has
already fixed the toolchain, `tsconfig` path aliases (or the documented
relative-import fallback), and pinned versions — **use them, do not introduce new
deps or alternative config**. Read `tooling`'s `COMPLETE.md` (in
`../SUBTASK_tooling/`) for the import-convention decision and follow it.

## Inputs (read at start)
- `../_GLOBAL.md` — inherited constraints (§4), path-alias decision (§8), success criteria (§9).
- `../../_GLOBAL.md` — architecture (§4: shared core role), conventions (§7).
- `../../contracts/errors.ts` — **you implement this**: `ErrorCode`, `Diagnostic`,
  `KleinError`, `DiagnosticFormatter`, `StackFrame`, `ErrorPhase`, `Severity`.
- `../../contracts/tokens.ts` — `Position` and `Span` shapes you build helpers around.
- `../SUBTASK_tooling/COMPLETE.md` — the toolchain/import-convention decisions (dependency output).

## Owned outputs (exclusive — write ONLY these)
- `src/core/span.ts` — `Position`/`Span` construction + merge/utility helpers over
  the `contracts/tokens.ts` shapes.
- `src/core/errors.ts` — concrete `LexicalError`, `SyntaxErr`, `RuntimeErr` classes
  extending native `Error` and `implements contracts/errors.ts#KleinError`, carrying
  `code`, `phase`, `span`, `message`, optional runtime `stack: StackFrame[]`, and a
  `toDiagnostic()` reduction. No `any` in the public surface.
- `src/core/diagnostic.ts` — the `DiagnosticFormatter` implementation: snippet +
  caret rendering with 1-based line/column, optional ANSI color, matching the exact
  format shown in `contracts/errors.ts`.
- `src/core/index.ts` — barrel re-exporting the public core surface.
- `tests/core/**` — Vitest unit tests for the formatter (snippet/caret/color,
  multi-line spans, edge cases) and the error classes (`toDiagnostic()`, `Span`
  presence, `ErrorCode` values). Tests key off `ErrorCode`, never message text.

Write NOTHING outside `src/core/**` and `tests/core/**`. Do not modify `contracts/`
or any `tooling`/`docs` file.

## Success criteria
- `npm run build` stays green with `src/core/` present (strict, no `any` leak).
- `npm run lint` and `npm run format:check` pass on the new files.
- `tests/core/` pass under `vitest run` with ≥90% line coverage on `src/core/`.
- Rendering a sample `Diagnostic` through the formatter reproduces the
  `error[Exxxx]: … / --> src:line:col / snippet / caret` layout in `contracts/errors.ts`.
- Error classes are real `Error` subclasses (interoperate with `throw`/stack) AND
  structurally satisfy `KleinError`.

## Constraints
- Import contract types literally (`import { ErrorCode, Diagnostic } from "@contracts"`
  or the relative form `tooling` proved); never paraphrase or re-declare them.
- Follow the inherited conventions (`../_GLOBAL.md` §4): discriminated unions +
  exhaustive `switch`/`never` where you branch on `ErrorPhase`/`ErrorCode`.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. Three distinct modules
(span / errors / diagnostic renderer) live here; if your reading finds they warrant
separate atomic tasks (the renderer especially can be substantial), decompose —
that judgement is yours, per the kernel's independent-evaluation rule.
