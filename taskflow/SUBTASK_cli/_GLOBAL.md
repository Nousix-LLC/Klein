# SUBTASK_cli — Public API facade, CLI, and REPL (subtree hub)

**Subtree hub (`_GLOBAL.md`).** Shared, write-once context for the four children of
the `cli` task. Read this plus the project root `../../_GLOBAL.md`, this task's own
`../_BRIEF.md`, and your own `SUBTASK_*/_BRIEF.md`. Treat `../../contracts/` as
read-only ground truth.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Parent**: `cli`
(depends on `stdlib`; dependent is the project-level `integration` hub).

---

## 1. Why this task decomposed

The `cli` brief (`../_BRIEF.md`) explicitly enumerates **three distinct concerns**
and asks for an honest atomicity evaluation. The kernel's Scope-Based trigger and
Distinct Concerns Test fire on that enumeration alone; the Single-Responsibility
Test fires because the faithful description joins distinct verbs ("wire the facade
AND build the CLI AND build the REPL"), each with its own kind of output. Output
size (multiple `src/` modules + `bin/` + multi-file `tests/cli/`) reinforces it.
Verdict: **NeedsDecompose**, in the kernel's default serial shape
**precursor → transform(s) → synthesis**.

## 2. The pipeline this task integrates (all upstream stages are REAL + COMPLETE)

```
source ─▶ Lexer ─▶ Token[] ─▶ Parser ─▶ AST(Program) ─▶ Interpreter ─▶ Value
                                                          ▲
                                          stdlib builtins ┘
```

Concrete, verified export surfaces the children compose against (import these;
never re-declare, never edit `contracts/`):

- `../../contracts/pipeline.ts` — `LexResult`, `ParseResult`, **`InterpretOutcome`
  `{ ok, value, diagnostics }`**, **`InterpretFacadeOptions`
  `{ sourceName?, write?, builtins?, maxCallDepth? }`**.
- `../../contracts/errors.ts` — `ErrorCode`, `Diagnostic`, `ErrorPhase`,
  `KleinError`, `DiagnosticFormatter`.
- `../../contracts/values.ts` — `Value`, `InterpreterOptions`, `BuiltinValue`.
- `../src/lexer` → `new Lexer(source, sourceName).tokenize(): LexResult`.
- `../src/parser` → `new Parser(tokens, sourceName).parse(): ParseResult`.
- `../src/runtime` → `new Interpreter(options: InterpreterOptions = {})` with
  `.run(program): Value` (throws `RuntimeErr` on the first runtime fault),
  `.globals: Environment`, plus `stringify`, `makeNumber`, singletons, etc.
- `../src/stdlib` → `defaultBuiltins(): BuiltinValue[]` (the roster to install).
- `../src/core` (`@core`) → concrete `LexicalError`, `SyntaxErr`, `RuntimeErr`,
  and the `DiagnosticFmt` / `diagnosticFormatter` / `formatDiagnostic` renderer +
  `RenderOptions`. **Render diagnostics only through this — do not reimplement.**

## 3. Scaffold facts that BIND every child (do not re-decide)

- **`bin` entry is `bin/klein.mjs`** (per `../package.json` → `"bin": { "klein":
  "bin/klein.mjs" }`). The scaffold already fixed this filename. Wire that exact
  path; do NOT invent `bin/klein`.
- ESM `NodeNext`, TypeScript strict, no `any` in exported signatures. Node ≥ 18.
- Test runner **Vitest** (`vitest run`, `--coverage` via v8). Lint **ESLint**,
  format **Prettier**. Scripts: `build` (`tsc -p tsconfig.build.json`),
  `typecheck`, `lint`, `format:check`, `test`, `coverage`.
- Tests key off `ErrorCode` (structured), never on human-readable message text.
- Pure re-export barrels are excluded from coverage per `vitest.config.ts`; files
  that carry logic (facade, cli, repl, and the dispatch `main`) are NOT excluded.
- Determinism: value rendering is owned by `runtime`'s `stringify`; the CLI/REPL
  print via `stringify` and the shared renderer, not ad-hoc formatting.

## 4. Child task structure & DAG

| Child (slug) | Responsibility (one kind of change, one kind of output) | Depends on | Owned outputs |
|---|---|---|---|
| `SUBTASK_facade` | `interpret()` facade + public API barrel | — | `src/index.ts`, `tests/cli/interpret.test.ts` |
| `SUBTASK_cli_runner` | File runner as a pure `runCli(argv, io) → exit code` | facade | `src/cli/cli.ts`, `tests/cli/cli.test.ts` |
| `SUBTASK_repl` | Interactive REPL as `startRepl(io) → Promise<void>` | facade | `src/cli/repl.ts`, `tests/cli/repl.test.ts` |
| `SUBTASK_synthesis` | Tie children together (`src/cli/index.ts` barrel + `main` dispatch + `bin/klein.mjs`), verify subtree composes | cli_runner, repl | `src/cli/index.ts`, `bin/klein.mjs`, `tests/cli/bin.test.ts`, `COMPLETE.md` |

```
facade ─▶ cli_runner ─┐
      └─▶ repl ───────┴─▶ synthesis
```

**Ownership is disjoint — no two children write the same file** (state-safety
requirement). `bin/klein.mjs` and the `main` dispatch (no-args ⇒ REPL, else ⇒ run)
live in `synthesis` because only synthesis depends on BOTH `runCli` and
`startRepl`; keeping them there lets `cli_runner` and `repl` stay decoupled and
run in parallel, each exporting one pure entry function.

## 5. Interface contract between children (so the pieces compose)

- `SUBTASK_facade` exports from `src/index.ts`:
  - `interpret(source: string, options?: InterpretFacadeOptions): InterpretOutcome`
    — lex → parse (collect lexical+syntax diagnostics; **short-circuit before
    `run` if any diagnostics exist**) → `new Interpreter({...}).run(program)`,
    catching `RuntimeErr` into a `Diagnostic` (via `toDiagnostic()`). Defaults:
    `sourceName = "<script>"`, `builtins = defaultBuiltins()`, `write = process.stdout`.
  - Re-exported public surface: the contract **types** (`Value`, `Diagnostic`,
    `ErrorCode`, `InterpretOutcome`, `InterpretFacadeOptions`, …) and the concrete
    error classes (`LexicalError`, `SyntaxErr`, `RuntimeErr`) from `@core`.
- `SUBTASK_cli_runner` exports `runCli` from `src/cli/cli.ts`:
  - Signature (children finalize exact shape): `runCli(argv: readonly string[],
    io: CliIo): number` where `CliIo` carries `stdout(write)`, `stderr(write)`,
    `readFile`, `stdin` source, and a `color` flag. Returns the process exit code
    (0 on no diagnostics; non-zero if any diagnostic was emitted). It calls
    `interpret()` and renders diagnostics via the shared `DiagnosticFmt`.
  - Handles `klein file.kl`, `--eval "…"`/`-e`, read-from-stdin (`-` or piped),
    `--version` (read from `../package.json`), `--help`.
- `SUBTASK_repl` exports `startRepl` from `src/cli/repl.ts`:
  - `startRepl(io: ReplIo): Promise<void>` — a persistent global `Environment`
    (or a persistent facade options bag) shared across entries; multiline
    continuation on unbalanced input; errors rendered readably and do NOT kill
    the session; `.exit` and `.help` meta-commands.
- `SUBTASK_synthesis` provides `src/cli/index.ts` exporting `runCli`, `startRepl`,
  and `main(argv, io): Promise<number>` (dispatch); `bin/klein.mjs` calls `main`
  and `process.exit`s its result. It also OWNS the subtree quality gate.

If any child finds this interface inadequate, it MUST request an **additive** plan
amendment — it MUST NOT edit `contracts/` or silently diverge.

## 6. Testability convention (binding)

Every entry function takes its I/O by dependency injection (no hard-coded
`process.stdout`/`stdin`/`fs` in the tested core): tests inject fake
`stdout`/`stderr` sinks, a fake `readFile`, and a scripted `stdin`. `bin/klein.mjs`
is the ONLY place that binds the real `process`/`fs` handles. This keeps
`src/cli/**` deterministically testable to ≥90% coverage.

## 7. Success criteria (subtree-level — `synthesis` is the gate)

- [ ] `interpret()` returns a correct `InterpretOutcome` for ok / lex-error /
  parse-error / runtime-error cases (facade tests).
- [ ] `node bin/klein.mjs <file>` runs a program and prints output; a bad program
  prints a rendered, source-anchored diagnostic and exits non-zero.
- [ ] REPL evaluates across lines with shared state; multiline continuation,
  readable non-fatal errors, `.exit`/`.help` all work (session tests, injected I/O).
- [ ] `tsc` (build + typecheck), `eslint`, `prettier --check` all clean over the
  new files. No `any` in the public surface.
- [ ] `tests/cli/**` cover facade + argv parsing + REPL session behavior;
  **≥90% line coverage of `src/cli`** (verified by `synthesis`).
- [ ] `contracts/` unmodified; child ownership disjoint and respected.
