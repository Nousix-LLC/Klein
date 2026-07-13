# Task: Concrete Klein error classes — `src/core/errors.ts` + tests

**Slug**: `errors` · **Task id**: `scaffold.core.errors` · **Depends on**: `span`
(`scaffold.core.span`). **Dependents**: `synthesis` (and every later Klein stage
that throws a Klein error).

## Objective
Implement the concrete error classes that implement
`contracts/errors.ts#KleinError` and extend native `Error`, so every pipeline stage
throws source-anchored, structured errors — plus unit tests proving them.

## Context
Part of the Klein `core` subtree (see `../_GLOBAL.md`). `span` (dependency) is
COMPLETE: reuse its span construction/merge helpers rather than re-deriving span
logic. Read `../SUBTASK_span/COMPLETE.md` (dependency output) for its exact exported
surface, then import from `./span`.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree constraints (§4), import convention (§5), contract surface (§8).
- `../../../contracts/errors.ts` — **you implement this**: `KleinError`, `ErrorCode`,
  `ErrorPhase`, `Severity`, `Diagnostic`, `StackFrame` (import literally from `@contracts`).
- `../../../contracts/tokens.ts` — `Span`/`Position` (via `@contracts`).
- `../SUBTASK_span/COMPLETE.md` + `src/core/span.ts` — the span helpers to reuse.
- `../../SUBTASK_tooling/COMPLETE.md` §5 — binding conventions.

## Owned outputs (exclusive — write ONLY these)
- `src/core/errors.ts` — concrete `LexicalError`, `SyntaxErr`, `RuntimeErr` classes
  (a shared abstract base is fine) that:
  - `extends Error` **and** `implements KleinError` (real subclasses that
    interoperate with `throw`/stack; set `name`, restore prototype chain as needed
    under the TS/ES `extends Error` idiom);
  - carry `code: ErrorCode`, `phase: ErrorPhase`, `span: Span`, `message`, and —
    for `RuntimeErr` only — an optional runtime `stack: StackFrame[]` (the Klein
    call stack, distinct from the JS `Error.stack`);
  - implement `toDiagnostic(): Diagnostic` (a faithful reduction: severity/phase/
    code/message/span, and `stack` when present). Each class fixes its own `phase`.
  - No `any` in the public surface; branch exhaustively where you switch on
    `ErrorPhase`/`ErrorCode`.
- `tests/core/errors.test.ts` — Vitest unit tests keyed off `ErrorCode` and
  structured fields (**never** message text): `instanceof Error` + `instanceof` the
  concrete class, `phase`/`code`/`span` presence and correctness, `toDiagnostic()`
  round-trip (incl. `RuntimeErr` stack passthrough), and that a thrown instance is
  catchable and carries its span. Clear the ≥90% bar on `src/core/errors.ts`.

Write NOTHING outside those two paths. Do not modify `contracts/`, `span.ts`,
config, docs, or any sibling's files.

## Success criteria
- `npm run build`, `npm run lint`, `npm run format:check` green on the new files; no `any` leak.
- `tests/core/errors.test.ts` passes under `vitest run`; `src/core/errors.ts` ≥90% covered.
- Instances are real `Error` subclasses AND structurally satisfy `KleinError`;
  `toDiagnostic()` produces a `Diagnostic` matching the contract shape exactly.

## Constraints
- Implement the `KleinError` interface literally from `@contracts`; do not
  re-declare contract types. Reuse `./span` helpers for any span construction/merge.
- Extensionless relative/`@contracts` imports; import the Vitest API explicitly.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch (expected atomic).
