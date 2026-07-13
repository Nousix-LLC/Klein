# Task: End-to-end & error test harness (golden + structured-code assertions)

**Slug**: `SUBTASK_e2e_tests` · **Depends on**: `SUBTASK_examples` · **Dependents**: `SUBTASK_verification`.

## Objective
Author the Vitest end-to-end suites that run every committed example through the
**real** interpreter and assert (a) `ok` examples reproduce their golden stdout, and
(b) `error` examples emit exactly their expected `ErrorCode`s with a real
snippet+caret diagnostic — data-driven from `examples/index.json`.

## Single responsibility
Produce the E2E test code (`tests/integration/**`, `tests/errors/**`). You author NO
example programs (your sibling did) and run NO integrity gate (the next sibling does).

## Inputs (read at start)
- `../_GLOBAL.md` (**read §3 the shared golden contract, §4 how to run Klein, §5
  conventions**) and `../../_GLOBAL.md` (project hub).
- `../../examples/**` — the programs, `.out`/`.diag` goldens, and `index.json`
  produced by `SUBTASK_examples` (COMPLETED before you run; read them, do not
  regenerate or edit them).
- `../../src/index.ts` (`interpret()`), `../../src/cli/**` (`runCli`/`main`, injectable
  `CliIo`/`MainIo`), `../../bin/klein.mjs`, `../../src/core` (`formatDiagnostic`),
  `../../contracts/errors.ts` (`ErrorCode`).
- The existing `../../tests/**` suites — **match their Vitest style and harness
  conventions** (import the public surface from `../../src/index` where appropriate;
  key off `ErrorCode`/`ValueKind`, never message text).

## Approach (guidance — you decide the exact file layout and helpers)
1. **Be data-driven.** Load `examples/index.json` once and iterate; do not hard-code
   per-example expectations in the test bodies. Read each program's source and goldens
   from disk relative to the project root.
2. **`tests/integration/**` — `ok` examples.** For each `kind:"ok"` entry: run the
   program through the real pipeline capturing stdout with a deterministic,
   color-free sink — either `interpret(source, { sourceName, write: capture })`, or
   `runCli([file], cliIo)` / `main([...], mainIo)` with an injected capturing I/O
   surface — and assert captured stdout **exactly equals** `examples/<name>.out` and
   the run reports success (no diagnostics / exit `0`).
3. **At least one true-process E2E.** For a representative example, spawn the shipped
   executable (`node bin/klein.mjs examples/<name>.kl` via `node:child_process`,
   `NO_COLOR` set) and assert real stdout + exit code — proving the `bin` path, not
   just the in-process facade. (Keep this to a small number; `tsx` startup is not free.)
4. **`tests/errors/**` — `error` examples.** For each `kind:"error"` entry: run through
   `interpret()` and assert `diagnostics.map(d => d.code)` deep-equals `expectedCodes`
   (structured, ordered); assert every diagnostic carries a `span`; render each via
   `formatDiagnostic(d, source, { color:false })` and assert it contains a source
   snippet and a `^` caret and the `--> …:line:col` location, and matches the committed
   `examples/<name>.diag` golden.
5. Keep suites strict-clean and Prettier-clean (they are linted and format-checked by
   the verification gate).

## Owned outputs
`tests/integration/**` and `tests/errors/**` (test files + any local harness helpers),
plus your completion record `COMPLETE.md` (in this workspace) summarizing coverage and
how the suites map to `index.json`.

## Success criteria
- `vitest run` over your new suites is green, and every `examples/index.json` entry is
  covered by exactly the assertions above.
- Golden stdout comparisons are byte-exact; error assertions key off `ErrorCode`
  (structured), with the rendered `.diag` as a snapshot check.
- At least one test drives the real `bin/klein.mjs` process end-to-end.
- No example, source, or contract file is modified.

## Constraints
- Write ONLY under `tests/integration/**` and `tests/errors/**`. Do not modify
  `../../examples/**`, `../../src/**`, `../../contracts/**`, or any other owned subtree.
- If a golden/`index.json` from `SUBTASK_examples` is missing, malformed, or disagrees
  with real behavior, that is an inadequate-dependency condition: report it precisely
  (name `SUBTASK_examples`, request an additive amendment) rather than papering over it
  by editing the examples yourself.
- Re-run your own atomic-vs-decompose evaluation at dispatch; expected atomic (one kind
  of output — E2E test code).
