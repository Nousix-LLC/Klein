# Task: `interpret()` facade + public API barrel

**Slug**: `facade` · **Depends on**: — (reads the completed `../../src/**`) ·
**Dependents**: `cli_runner`, `repl`, `synthesis`

## Objective
Produce `src/index.ts`: the single `interpret()` facade that wires the completed
lexer → parser → interpreter pipeline into one discriminated `InterpretOutcome`,
plus the package's public API barrel (types + `interpret` + error classes).

## Context
Part of the `cli` subtree (see `../_GLOBAL.md`, esp. §2 export surfaces, §5 the
`interpret` contract, §3 scaffold facts). You are the **precursor**: the CLI runner
and the REPL both build on your `interpret()`. Every upstream stage is real and
complete; import it, do not stub it.

## Inputs (read at start)
- `../_GLOBAL.md` and the project root `../../_GLOBAL.md`.
- `../../contracts/pipeline.ts` (`InterpretOutcome`, `InterpretFacadeOptions`),
  `../../contracts/errors.ts` (`Diagnostic`, `ErrorCode`, `KleinError`),
  `../../contracts/values.ts` (`Value`, `InterpreterOptions`, `BuiltinValue`).
- The real modules you compose: `../../src/lexer`, `../../src/parser`,
  `../../src/runtime`, `../../src/stdlib`, `../../src/core` (`@core`).

## Approach (finalize the details yourself; keep it boring and correct)
- `interpret(source, options?)`: construct `Lexer` → collect `LexResult`; feed
  tokens to `Parser` → collect `ParseResult`. Merge lexical + syntax `errors` into
  `Diagnostic[]` in source order. **If any diagnostics exist, short-circuit before
  running** (`ok: false`, `value: null`). Otherwise construct `Interpreter` with
  `{ write, builtins ?? defaultBuiltins(), maxCallDepth }`, `.run(program)`,
  catching `RuntimeErr` and converting via `toDiagnostic()`. Return `InterpretOutcome`.
- Defaults: `sourceName = "<script>"`, `write` → `process.stdout.write`, full
  stdlib builtins. No `any` in the exported signature.
- Re-export the intended public surface: contract **types** and the concrete
  `LexicalError`/`SyntaxErr`/`RuntimeErr` error classes (from `@core`). This barrel
  is the package's library entry — keep it the deliberate public API, nothing more.

## Owned outputs
`src/index.ts`, `tests/cli/interpret.test.ts`. (Do NOT create `src/cli/**`,
`bin/**`, or `src/cli/index.ts` — those belong to sibling tasks.)

## Success criteria
- `interpret()` yields the correct `InterpretOutcome` for **ok**, **lex-error**,
  **parse-error**, and **runtime-error** inputs — asserted against structured
  `ErrorCode`s and `ok`/`value`/`diagnostics`, never message text.
- Injecting a `write` sink captures `print`/`println` output deterministically.
- `tsc`/lint/format clean; no `any` in the public surface.

## Constraints
- Import the contract + real `src/` modules literally; never edit `contracts/`.
- Take output via the `write` option (injectable) so the facade is testable
  without touching the real `process.stdout`.
- If the `InterpretFacadeOptions`/`InterpretOutcome` contract is inadequate,
  request an **additive** amendment; do not diverge silently.
