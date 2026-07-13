# SUSPENSION — `cli` decomposed (NeedsDecompose)

**Task**: `cli` (Public API facade, CLI, REPL) · **Date**: 2026-07-13
**Terminal state**: SUSPENDED · **decompose_evaluation**: NeedsDecompose
**Resumption**: implicit — all child tasks reach terminal state.

## Why this task suspended (not failed, not completed)
The `cli` brief explicitly enumerates **three distinct concerns** and asks for an
honest atomicity evaluation. Applying the kernel triggers to my own brief and
context:

- **Scope-Based trigger / Distinct Concerns Test — FIRES.** Three enumerated
  concerns: (1) `interpret()` facade + public API, (2) CLI file runner, (3) REPL.
  The facade is a precursor; the CLI and REPL are independent consumers that a
  parallel pair of specialists could build.
- **Single-Responsibility Test — FIRES.** The faithful description joins distinct
  verbs ("wire the facade AND build the CLI AND build the REPL") with distinct
  kinds of output.
- **Output-Size trigger — FIRES.** `src/index.ts`, `src/cli/cli.ts`,
  `src/cli/repl.ts`, `src/cli/index.ts`, `bin/klein.mjs`, and multi-file
  `tests/cli/**` — well over 400 lines total.
- **Trigger Precedence.** Scope/concern signals win; "it is one cohesive subtree /
  shares one API" is NOT grounds to declare Atomic. The kernel bias toward
  decomposition governs.

Verdict: **NeedsDecompose**, in the default serial shape
**precursor → transform(s) → synthesis**.

## Subtree authored
Hub: `SUBTASK_cli/_GLOBAL.md` (shared context, verified upstream export surfaces,
binding scaffold facts incl. `bin/klein.mjs`, disjoint ownership map, interface
contract between children).

| Child (id / slug) | Responsibility | Depends on | Owned outputs |
|---|---|---|---|
| `cli.facade` / `SUBTASK_facade` | `interpret()` facade + public API barrel | — | `src/index.ts`, `tests/cli/interpret.test.ts` |
| `cli.cli_runner` / `SUBTASK_cli_runner` | File runner `runCli(argv, io)` | `cli.facade` | `src/cli/cli.ts`, `tests/cli/cli.test.ts` |
| `cli.repl` / `SUBTASK_repl` | REPL `startRepl(io)` (persistent state) | `cli.facade` | `src/cli/repl.ts`, `tests/cli/repl.test.ts` |
| `cli.synthesis` / `SUBTASK_synthesis` | Barrel + `main` dispatch + `bin/klein.mjs` + subtree quality gate + `COMPLETE.md` | `cli.cli_runner`, `cli.repl` | `src/cli/index.ts`, `bin/klein.mjs`, `tests/cli/bin.test.ts`, `COMPLETE.md` |

```
cli.facade ─▶ cli.cli_runner ─┐
          └─▶ cli.repl ───────┴─▶ cli.synthesis
```

## Key decisions encoded for the children
- **Disjoint ownership** — no two children write the same file (state-safety).
- **`bin/klein.mjs` + no-args→REPL dispatch live in `synthesis`**, the only child
  that depends on both `runCli` and `startRepl`; this keeps `cli_runner` and `repl`
  decoupled and parallelizable, each exporting one pure entry function.
- **Injectable I/O everywhere** (`_GLOBAL.md §6`): real `process`/`fs`/TTY binding
  is confined to `bin/klein.mjs`, so `src/cli/**` is deterministically testable to
  the ≥90% coverage bar.
- **Scaffold `bin` filename is `bin/klein.mjs`** (from `package.json`), not the
  `bin/klein` the parent brief wrote informally — the scaffold's wiring binds.
- `contracts/` remains read-only; children import literally and request additive
  amendments if any contract proves inadequate.

## Resumption
This task remains SUSPENDED until `cli.facade`, `cli.cli_runner`, `cli.repl`, and
`cli.synthesis` all reach terminal state. `cli.synthesis` is the subtree gate and
produces the consolidated `COMPLETE.md` that the project-level `integration` hub
consumes.
