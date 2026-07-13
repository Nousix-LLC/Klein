# Task: Interactive REPL (`startRepl`)

**Slug**: `repl` · **Depends on**: `facade` · **Dependents**: `synthesis`

## Objective
Produce `src/cli/repl.ts`: an injectable `startRepl(io)` implementing an
interactive read-eval-print loop with a **persistent global environment across
entries**, multiline continuation on unbalanced input, readable non-fatal error
rendering, and `.exit` / `.help` meta-commands.

## Context
Part of the `cli` subtree (see `../_GLOBAL.md`, esp. §5 the `startRepl` contract,
§6 testability, §3 scaffold facts). You build on the facade and the real runtime.
You do **not** own `bin/` or the top-level dispatch — those are `synthesis`.

## Inputs (read at start)
- `../_GLOBAL.md`, `../../_GLOBAL.md`.
- `../../src/index.ts` (facade) and `../../src/runtime` (`Interpreter`,
  `Environment`, `stringify`) and `../../src/stdlib` (`defaultBuiltins`).
- `../../src/core` for diagnostic rendering; `../../contracts/*` for types.

## Approach (persistent state is the crux — decide the cleanest mechanism)
- Persist a single global scope across entries so `let x = 1` then `x + 1` on the
  next line works. Two viable shapes — pick one and justify it in your completion
  record: (a) hold one long-lived `Interpreter` and feed each entry's parsed
  `Program` to a `run`-on-shared-globals path, or (b) thread a persistent
  `Environment`/facade options bag through repeated `interpret()` calls. Whichever
  you choose, per-entry lexical/syntax/runtime errors must render readably and
  **must not terminate the session**.
- Multiline continuation: when an entry is incomplete (unbalanced braces/parens/
  brackets or an open string/block comment), show a continuation prompt and keep
  reading until the buffer is balanced (or the user cancels).
- Meta-commands: `.exit` (quit cleanly) and `.help` (usage). Print evaluated
  values via the runtime `stringify` (skip printing `null` for statements that
  produce nothing meaningful — document the choice).
- All prompts/output/errors go through injected `io.stdout`/`io.stderr`; input
  comes from an injected line source so a scripted session is fully testable.

## Owned outputs
`src/cli/repl.ts`, `tests/cli/repl.test.ts`. (Do NOT create `src/cli/cli.ts`,
`src/cli/index.ts`, `bin/**`, or `src/index.ts`.)

## Success criteria
- A scripted multi-line session with injected stdin/stdout demonstrates **shared
  state** (a binding defined on one line is visible on a later line).
- Multiline continuation assembles an unbalanced entry across lines then evaluates it.
- A runtime/syntax error mid-session renders a readable diagnostic and the session
  continues to accept the next entry.
- `.exit` ends the loop; `.help` prints usage. `tsc`/lint/format clean; no `any`
  in exported signatures.

## Constraints
- All I/O injected (`../_GLOBAL.md` §6); real `process.stdin` binding is `bin`'s job.
- Reuse the facade / runtime / `@core` renderer; never reimplement rendering or
  the value stringifier; never edit `contracts/`.
