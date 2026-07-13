# COMPLETE — `cli_runner`: the Klein file runner (`runCli`)

**Task**: `SUBTASK_cli_runner` (subtree `SUBTASK_cli`) · **Decompose eval**: Atomic
**Depends on**: `facade` (consumed) · **Dependents**: `synthesis`
**Status**: COMPLETED — outputs authored, full quality gate green.

---

## What was produced

| Output (owned) | Role |
|---|---|
| `src/cli/cli.ts` | Pure, injectable `runCli(argv, io): number` — argv parsing → `interpret()` → diagnostic rendering → exit code. Also exports the `CliIo` seam and the `ExitCode` enum. |
| `tests/cli/cli.test.ts` | 29 tests covering every argv mode, keyed off structured `ErrorCode`s and returned exit codes (never message text). |

Ownership respected: I did **not** create `src/cli/repl.ts`, `src/cli/index.ts`,
`bin/**`, or `src/index.ts`. `contracts/` untouched.

## Interface delivered (finalizes `../_GLOBAL.md` §5)

```ts
export interface CliIo {
  stdout(text: string): void;         // program output, --help, --version
  stderr(text: string): void;         // rendered diagnostics + usage/IO errors
  readFile(path: string): string;     // throws on missing/unreadable → reported as usage/IO error
  readStdin(): string;                // for `-` and piped input
  stdinIsPiped: boolean;              // non-TTY stdin (TTY probe done by bin/main)
  color: boolean;                     // ANSI color decision (done by bin/main)
  version: string;                    // for --version, sourced from package.json by main
}
export enum ExitCode { Ok = 0, Diagnostics = 1, Usage = 2 }
export function runCli(argv: readonly string[], io: CliIo): number;
```

### Behavior
- **Modes**: `klein <file.kl>` · `--eval "<code>"` (aliases `-e`, `--eval=<code>`) ·
  `-` / piped stdin · `--version` (alias `-v`) · `--help` (alias `-h`). `--`
  terminates option parsing.
- **Exit codes**: `0` no diagnostics; `1` any diagnostic (lexical/syntax/runtime);
  `2` usage or I/O error (unknown flag, missing/conflicting args, unreadable input,
  no-input-with-TTY). Conventional `2 = command misuse`.
- **Rendering**: every diagnostic goes through the shared `@core` `formatDiagnostic`
  (imported literally; never reimplemented), source-anchored, honoring `io.color`.
  Program output (`print`/`println`) is routed to `io.stdout` via `interpret`'s
  `write` option; diagnostics go to `io.stderr`. The two streams stay separate even
  when a program prints before faulting at runtime.
- **Purity**: `runCli` calls no `process.exit`, touches no real `process`/`fs`; a
  purity test asserts `process.stdout.write`/`process.exit` are never invoked.

## Design decisions & justifications

1. **`--version` source — threaded through `io.version`, not read from disk here.**
   The brief lists `package.json` as an input and `../_GLOBAL.md` §5 says "read from
   package.json"; §6 (binding) says *"`bin/klein.mjs` is the ONLY place that binds
   the real `process`/`fs` handles."* Reading `package.json` is real fs I/O, so per
   §6 it must be injected. `main` (owned by `synthesis`) reads `package.json` and
   passes `version` in. This keeps `runCli` a pure function of `(argv, io)`, fully
   testable with a fake version, while the version still *originates from*
   `package.json` — reconciling the two directives rather than violating §6.
   **Action for `synthesis`**: when wiring `main`/`bin`, populate `io.version` from
   `package.json` `version` (currently `0.1.0`).

2. **Dependency-light argv parsing — ZERO dependencies added.** A small hand-rolled
   parser (`parseArgs` → discriminated `Intent`) covers all required modes plus
   `--`, `--eval=`, and explicit conflict detection. Per the brief's constraint
   ("prefer none"), no argv-parsing library was introduced.

3. **`stdinIsPiped` seam instead of a direct TTY probe.** The brief forbids probing
   the TTY here. `main` computes `!process.stdin.isTTY` and passes it; `runCli` uses
   it only to decide the "no explicit input + piped ⇒ run stdin" case. The no-args +
   interactive case is a usage error here *by design* — the no-args ⇒ REPL dispatch
   is `synthesis`'s `main`, not this function.

4. **`ExitCode` enum exported** so `synthesis`/`bin` and tests reference stable,
   named codes rather than magic numbers.

## Verification (all green)

- `vitest run tests/cli/cli.test.ts` → **29/29 pass**; full `tests/cli` (with the
  facade suite) → **49/49 pass** (no regression to the sibling `facade` suite).
- `tsc -p tsconfig.json --noEmit` → clean (strict; no `any` in the exported surface).
- `eslint src/cli/cli.ts tests/cli/cli.test.ts` → clean.
- `prettier --check` on both files → clean.
- Coverage of `src/cli/cli.ts`: **100% lines / 100% statements / 100% functions /
  95.58% branches** — above the ≥90% bar on every axis. The 3 uncovered branches are
  `noUncheckedIndexedAccess`-mandated `?? ""` fallbacks that are unreachable given
  the loop guards.

## How this composes upstream/downstream

- **Upstream**: imports `interpret` from the facade's `../index` and
  `formatDiagnostic` from `@core`; `Diagnostic` type from `@contracts`. All imported
  literally — no re-declared pipeline, no reimplemented rendering.
- **Downstream (`synthesis`)**: `src/cli/index.ts` should re-export `runCli`
  (and `CliIo`/`ExitCode`); `main(argv, io)` dispatches no-args-interactive → REPL,
  else → `runCli`; `bin/klein.mjs` binds real `process`/`fs` (incl. `io.version` from
  `package.json`, `io.stdinIsPiped = !process.stdin.isTTY`, `io.color` = out-stream
  TTY) and `process.exit`s `runCli`'s returned code.

## Methodology-gap note
The software methodology bundle was unavailable to this agent
(`methodology_glob` → `agent_domain_unset`), consistent with root `_GLOBAL.md` §8.
Proceeded on the brief + contracts + hub as authoritative, per the kernel's
document-the-gap guidance; nothing here contradicts standard CLI construction.
