# Task: CLI file runner (`runCli`)

**Slug**: `cli_runner` · **Depends on**: `facade` · **Dependents**: `synthesis`

## Objective
Produce `src/cli/cli.ts`: a pure, injectable `runCli(argv, io)` that parses
command-line arguments, runs Klein source through `interpret()`, renders any
diagnostics through the shared formatter, and returns a correct process exit code.

## Context
Part of the `cli` subtree (see `../_GLOBAL.md`, esp. §5 the `runCli` contract, §6
the testability convention, §3 scaffold facts). You consume the facade
`interpret()` from `SUBTASK_facade`'s `src/index.ts`. You do **not** own the
executable entry (`bin/`) or the no-args→REPL dispatch — those are `synthesis`.
Your `runCli` is one pure function; `main` will call it.

## Inputs (read at start)
- `../_GLOBAL.md`, `../../_GLOBAL.md`.
- `../../src/index.ts` (the facade, from your dependency) and its re-exports.
- `../../src/core` for the diagnostic renderer (`DiagnosticFmt` /
  `formatDiagnostic`, `RenderOptions`); `../../contracts/errors.ts` for
  `Diagnostic`/`ErrorCode`. `../../package.json` for `--version`.

## Approach (keep argv parsing dependency-light — see constraints)
- Support: `klein file.kl` (run a file), `--eval "…"` / `-e` (run a literal),
  read from **stdin** (`-`, or when input is piped), `--version`, `--help`.
- Render each diagnostic via the shared `DiagnosticFmt` with the source text and a
  `color` flag (color when the out stream is a TTY — but the TTY check happens in
  `bin`/`main`, passed in via `io`, never probed directly here).
- Exit code: `0` when the run produced no diagnostics; non-zero when any
  diagnostic (lexical/syntax/runtime) was emitted, or on a usage/IO error
  (e.g. missing file) rendered as a clear message.
- `runCli(argv, io)` returns the exit code; it MUST NOT call `process.exit` itself
  (that is `bin`'s job) and MUST route ALL output through the injected
  `io.stdout`/`io.stderr` and read files/stdin through injected handles.

## Owned outputs
`src/cli/cli.ts`, `tests/cli/cli.test.ts`. (Do NOT create `src/cli/repl.ts`,
`src/cli/index.ts`, `bin/**`, or `src/index.ts`.)

## Success criteria
- Argv parsing covered: file / `--eval` / stdin / `--version` / `--help` / unknown
  flag / missing file — each asserted via injected `io` (captured stdout/stderr and
  returned exit code), keyed off `ErrorCode` where diagnostics are involved.
- A good program prints its output and returns exit code 0; a bad program prints a
  rendered, source-anchored diagnostic and returns a non-zero code.
- `tsc`/lint/format clean; no `any` in exported signatures.

## Constraints
- Argv parsing stays **dependency-light**: a tiny hand-rolled parser, or one small,
  well-justified dependency — **justify any dependency added, in your completion
  record**, and prefer none.
- All I/O injected per `../_GLOBAL.md` §6; the real `process`/`fs` binding is
  `bin`'s responsibility, not yours.
- Import the facade + `@core` renderer literally; never reimplement diagnostic
  rendering; never edit `contracts/`.
