# Task: Klein example programs + generated golden outputs

**Slug**: `SUBTASK_examples` · **Depends on**: none (upstream `cli` is COMPLETED; the
real interpreter, CLI and `bin` already exist on disk — this task is runnable now).
**Dependents**: `SUBTASK_e2e_tests`, `SUBTASK_verification`.

## Objective
Author a curated set of idiomatic Klein programs that exercise the language
end-to-end, and commit a **generated** golden output for each — establishing the
shared example/golden contract the E2E suite consumes.

## Single responsibility
Produce `examples/**` (programs + goldens + machine-readable index). You author NO
tests and run NO integrity checks — those are sibling tasks.

## Inputs (read at start)
- `../_GLOBAL.md` (this subtree's hub — **read §3 and §4 carefully**; they fix the
  golden file contract and how to run Klein) and `../../_GLOBAL.md` (project hub).
- `../../contracts/errors.ts` — the `ErrorCode` enum (string values like `"E3001"`)
  you cite in `index.json` for error examples.
- `../../src/stdlib/**` — **especially `registry.ts`**: the authoritative list of
  builtins that actually exist. Use ONLY real builtins in your programs.
- `../../src/index.ts` (`interpret()` facade), `../../bin/klein.mjs` (executable),
  `../../docs/LANGUAGE.md` and `../../docs/GRAMMAR.md` (language surface).

## Approach (guidance — you own the details; do not treat as an exhaustive runbook)
1. **Confirm the builtin surface first.** Read `src/stdlib/registry.ts` and the
   stdlib modules; note exactly which builtins (I/O like `print`/`println`, and any
   collection/string/math helpers) are registered. Every example must only use real
   language features and real builtins.
2. **Write a curated set** covering the language, each demonstrating something
   distinct. Suggested (adapt names/coverage to what the language actually supports):
   `fibonacci.kl`, `fizzbuzz.kl`, `closures.kl` (counter/adder over lexical capture),
   `higher_order.kl` (map/filter/reduce — only if those builtins exist; otherwise
   define them in-language as first-class functions), `data_structures.kl`
   (arrays + objects, insertion-ordered), and one or more **error** examples with
   intentional faults for the diagnostic demo (e.g. an undefined variable → `E3001`,
   a type mismatch → `E3002`, division by zero → `E3009` — pick faults whose codes
   you verify against `contracts/errors.ts`). Programs that should show output MUST
   `print`/`println` (the CLI does not echo the final value).
3. **Generate every golden by running the real interpreter** — never hand-write
   expected output. For `ok` examples capture stdout with color disabled; for `error`
   examples capture the rendered diagnostics (`formatDiagnostic(..., {color:false})`
   or `NO_COLOR node ../bin/klein.mjs <file>` stderr) into `.diag`, and record the
   emitted `ErrorCode`s (from `interpret().diagnostics`) as `expectedCodes`. A tiny
   throwaway generator script (run via `tsx`/`node`, not committed to `examples/`
   unless it is itself a documented example) is the intended way to produce goldens.
4. **Emit the shared contract exactly** as fixed in `../_GLOBAL.md §3`:
   `examples/<name>.kl`, `examples/<name>.out`, `examples/<name>.diag` (error only),
   `examples/index.json`, and a short `examples/README.md`.

## Owned outputs
`examples/**` only — the `.kl` programs, their `.out`/`.diag` goldens,
`examples/index.json`, `examples/README.md`, and your completion record `COMPLETE.md`
(in this workspace) summarizing the set and how goldens were generated.

## Success criteria
- Every `examples/*.kl` uses only real, registered language features/builtins and runs
  through the real interpreter without unintended host errors.
- Each `ok` example has a `.out` golden equal to its real captured stdout; each `error`
  example has a `.diag` golden equal to its real rendered diagnostics AND an
  `expectedCodes` entry whose codes match `interpret().diagnostics` in source order.
- `examples/index.json` is valid, complete, and matches the files on disk.
- Goldens were generated from real runs (documented in `COMPLETE.md`), not hand-authored.

## Constraints
- Write ONLY under `examples/**`. Do not modify `../../contracts/**`, `../../src/**`,
  `../../bin/**`, or any other task's owned subtree.
- If a needed feature genuinely does not exist in the implemented language, adapt the
  example to what exists (or implement the helper in-language) rather than assuming a
  missing builtin — and note the adaptation. If something is truly inadequate upstream,
  report it (request an additive amendment); do not edit upstream code.
- Re-run your own atomic-vs-decompose evaluation at dispatch; this is expected to be
  atomic (one kind of output — example programs + their goldens).
