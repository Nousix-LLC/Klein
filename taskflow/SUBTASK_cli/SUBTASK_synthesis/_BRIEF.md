# Task: CLI subtree synthesis — entry wiring + quality gate

**Slug**: `synthesis` · **Depends on**: `cli_runner`, `repl` · **Dependents**:
(satisfies the parent `cli`; the project-level `integration` hub consumes the result)

## Objective
Tie the three sibling deliverables into a runnable, verified whole: author the
`src/cli` barrel with the top-level `main` dispatch, wire the executable
`bin/klein.mjs`, and verify the entire `cli` subtree composes and meets the
quality bar. Author the subtree completion record.

## Context
Part of the `cli` subtree (see `../_GLOBAL.md`, esp. §4 DAG, §5 interfaces, §3
scaffold facts). You are the **synthesis hub**. Both `runCli` (from `cli_runner`)
and `startRepl` (from `repl`) are complete when you run, so only you may import
both — which is why the executable entry and the no-args→REPL dispatch live here.

## Inputs (read at start)
- `../_GLOBAL.md`, `../../_GLOBAL.md`, `../_BRIEF.md`.
- Sibling outputs: `../../src/index.ts` (facade), `../../src/cli/cli.ts`
  (`runCli`), `../../src/cli/repl.ts` (`startRepl`), and their tests.
- `../../package.json` (the `"bin": { "klein": "bin/klein.mjs" }` wiring and the
  `main`/`exports`/`tsconfig.build` output layout — determine what `bin` imports:
  the built entry vs. a runtime loader — and make `node bin/klein.mjs` actually work).

## Approach
1. **Barrel + dispatch** — `src/cli/index.ts` exports `runCli`, `startRepl`, and
   `main(argv, io): Promise<number>`. `main` dispatches: **no runnable args (and
   interactive stdin) ⇒ `startRepl`; otherwise ⇒ `runCli`**. `main` carries logic
   (it is NOT a pure re-export barrel), so it is covered by tests.
2. **Executable** — `bin/klein.mjs`: the ONLY place that binds real
   `process.argv`/`stdin`/`stdout`/`stderr`/`fs` and the TTY color check, builds
   the concrete `io`, calls `main`, and `process.exit`s its returned code.
3. **Verify the subtree composes** — run and make green: `tsc` (build +
   typecheck), `eslint`, `prettier --check`, `vitest run` for all `tests/cli/**`,
   and coverage; confirm **≥90% line coverage of `src/cli`**. A small
   `tests/cli/bin.test.ts` exercises `main`'s dispatch (run-a-file path AND
   no-args→REPL path) with injected `io`.
4. **Record** — author `COMPLETE.md`: what each child produced, how they compose,
   the verification results (command outputs / coverage number), any dependency
   `cli_runner` justified for argv parsing, and any deferred debt. No silent
   plugs — if anything is red, report it honestly (fail if it cannot be made green).

## Owned outputs
`src/cli/index.ts`, `bin/klein.mjs`, `tests/cli/bin.test.ts`, `COMPLETE.md`.
(Do NOT modify `src/index.ts`, `src/cli/cli.ts`, or `src/cli/repl.ts` — those are
your dependencies' files; if one is inadequate, request an amendment.)

## Success criteria
- `node bin/klein.mjs <file>` runs a program and prints output; a bad program
  prints a rendered diagnostic and exits non-zero; `node bin/klein.mjs` with no
  args starts a working REPL.
- `main` dispatch tested for both paths (injected `io`).
- `tsc`/`eslint`/`prettier --check` clean over all `cli`-subtree files; **≥90%
  line coverage of `src/cli`** demonstrated; no `any` in the public surface.
- `contracts/` unmodified; child ownership respected.

## Constraints
- Keep `bin/klein.mjs` a thin shim; all testable logic lives in `main`/siblings.
- Never edit `contracts/` or sibling-owned source files; never reimplement
  diagnostic rendering. Verification must be real (run the tools), not asserted.
