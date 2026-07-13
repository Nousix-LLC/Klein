/**
 * `src/cli` — the Klein command-line surface, as one barrel.
 *
 * This is a PURE re-export barrel: it wires the subtree's three logic modules
 * into a single import surface and carries no logic of its own. Consumers (the
 * executable entry `bin/klein.mjs`, and any embedder driving Klein
 * programmatically) import everything they need from `src/cli`:
 *
 *   - {@link main}    — the entry-point dispatch (REPL vs. file runner)
 *   - {@link runCli}  — the file/`--eval`/stdin runner, as a pure function
 *   - {@link startRepl} — the interactive REPL, as a pure function
 *
 * Per `vitest.config.ts`, `src/**\/index.ts` files are excluded from coverage as
 * re-export barrels; the actual dispatch logic therefore lives in `./main`
 * (covered), and this file stays a barrel so that exclusion remains truthful.
 */

export { main, type MainIo } from "./main";
export { runCli, ExitCode, type CliIo } from "./cli";
export { startRepl, type ReplIo } from "./repl";
