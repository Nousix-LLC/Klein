# Task: Public API facade, CLI, and REPL

**Slug**: `cli` · **Depends on**: `stdlib` · **Dependents**: `integration`

## Objective
Wire the full pipeline into a single `interpret()` facade and ship the two user
entry points — a file runner and a REPL — plus the package's public API barrel
and `bin`.

## Context
Part of **Klein** (see `../_GLOBAL.md`). You are the first task that sees every
real stage (`src/core`, `src/lexer`, `src/parser`, `src/runtime`, `src/stdlib`).
You produce the public `src/index.ts` and the `interpret()` facade whose result
type is `../contracts/pipeline.ts#InterpretOutcome`.

## Inputs (read at start)
- `../_GLOBAL.md`, `../contracts/pipeline.ts`, `../contracts/errors.ts`
- ALL of `../src/**` (real, completed) and `../package.json` (`bin` wiring, from scaffold).

## This task spans three distinct concerns (evaluate atomicity honestly)
1. **`interpret()` facade + public API** — `src/index.ts`: lex → parse → run,
   collecting lexical/syntax diagnostics (short-circuiting before run if any) and
   catching the interpreter's `RuntimeErr` into a diagnostic; return
   `InterpretOutcome`. Re-export the public surface (types, `interpret`, error classes).
2. **CLI / file runner** — `src/cli/cli.ts` + `bin/klein`: parse argv
   (`klein file.kl`, `--eval "…"`, `--version`, `--help`, read from stdin), run,
   render diagnostics via the scaffold `DiagnosticFormatter` (color when TTY),
   set a correct process exit code (0 ok; non-zero on any diagnostic).
3. **REPL** — `src/cli/repl.ts`: interactive loop with a persistent global
   environment across entries, multiline continuation on unbalanced input,
   readable rendered errors that don't kill the session, and `.exit`/`.help`.

Name these as distinct concerns so your own Scope/Distinct-Concerns evaluation is honest.

## Owned outputs
`src/index.ts`, `src/cli/**`, `bin/**`, `tests/cli/**`.

## Success criteria
- `interpret()` returns a correct `InterpretOutcome` for ok/lex-error/parse-error/runtime-error cases (tested).
- `node bin/klein <file>` runs a program and prints output; bad programs print a
  rendered diagnostic and exit non-zero. REPL evaluates across lines with shared state.
- `tsc`/lint/format clean; `tests/cli/**` cover facade + argv parsing + REPL session behavior (inject stdin/stdout). ≥90% coverage of `src/cli`.

## Constraints
- Import contract + all real `src/` modules; never edit `contracts/`. No `any` in public surface.
- Keep argv parsing dependency-light (a tiny hand-rolled parser or one small,
  well-justified dep — justify any dep in your completion record).
