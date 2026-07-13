# COMPLETE — `cli` subtree synthesis (entry wiring + quality gate)

**Task**: `SUBTASK_cli/SUBTASK_synthesis` · **Decompose evaluation**: `Atomic`
**Status**: COMPLETED · **Date**: 2026-07-13

I am the synthesis hub of the `cli` subtree. I tied the three sibling
deliverables into a runnable, verified whole, and ran the subtree quality gate
for real. Everything below is backed by executed commands, not assertion.

---

## 1. What each child produced, and how the pieces compose

The `cli` subtree is the pipeline's front door. Upstream stages
(`scaffold → lexer → parser → runtime → stdlib`) were real and complete before
this subtree ran; the three sibling spokes then built the user-facing surface,
and this node composed them:

| Child | Owned output | Role |
|---|---|---|
| `facade` | `src/index.ts` | `interpret(source, opts) → InterpretOutcome` — drives lex → parse → run, collects front-end diagnostics (short-circuits before `run`), catches `RuntimeErr` into a `Diagnostic`. Also the library's public API barrel. |
| `cli_runner` | `src/cli/cli.ts` | `runCli(argv, io: CliIo) → number` — pure, injectable file/`--eval`/stdin runner; parses argv, calls `interpret()`, renders diagnostics via the shared `@core` formatter, returns an exit code. |
| `repl` | `src/cli/repl.ts` | `startRepl(io: ReplIo) → Promise<void>` — interactive loop over one long-lived `Interpreter` (persistent globals), multiline continuation, non-fatal rendered errors, `.exit`/`.help`. |
| **`synthesis` (this)** | `src/cli/main.ts`, `src/cli/index.ts`, `bin/klein.mjs`, `tests/cli/bin.test.ts` | the entry-point **dispatch**, the barrel, the **executable**, and the subtree **quality gate**. |

**How they compose.** Only this node depends on *both* `runCli` and `startRepl`,
so the dispatch and the real-process binding live here (keeping the two siblings
decoupled and parallelizable, each a single pure entry function):

```
                       bin/klein.mjs  (binds real process/fs/readline; runs via tsx)
                              │  builds MainIo, calls main(argv, io), process.exit(code)
                              ▼
        main(argv, io)  ──────────────  src/cli/main.ts   (the ONE dispatch)
          │  empty argv + interactive TTY ⇒ startRepl → 0
          │  else (any args, or piped/non-TTY stdin)    ⇒ runCli → its code
          ├────────────▶ startRepl (repl.ts)  ─┐
          └────────────▶ runCli    (cli.ts)  ──┤─▶ interpret() (index.ts) ─▶ pipeline
```

`src/cli/index.ts` is a **pure re-export barrel** exposing `main`, `runCli`,
`startRepl` (+ their types/`ExitCode`) as the subtree's single import surface.

## 2. Dispatch rule (as implemented and tested)

- **no runnable args (empty argv) AND interactive TTY stdin ⇒ `startRepl`**, return `0`.
- **otherwise ⇒ `runCli`**, return its code. This deliberately routes the two
  complement cases to the runner, which already owns them: (a) any argument
  (`file.kl`, `--eval`, `--version`, `--help`, `-`), and (b) empty argv with
  **piped** (non-TTY) stdin, i.e. `echo '…' | klein`.

Only a bare, interactive `klein` reaches the REPL — the intuitive behavior.

## 3. The runtime/module-resolution decision `bin` had to make

`tsc` is a **type-check gate only** (`noEmit: true` in `tsconfig.build.json`), and
the read-only `contracts/` use extensionless + path-aliased imports (`@contracts`,
`@core`) that **plain Node ESM cannot resolve** (this is documented in the
scaffold's tsconfig rationale — `moduleResolution: bundler` paired with an
esbuild-based runtime). So there is no emitted JS entry to point `bin` at, and
even a hand-emitted one would not run under Node.

**Resolution**: `bin/klein.mjs` loads the TypeScript entry through **tsx**
(already a scaffold devDependency, `tsx@4.23.1`) via
`tsImport("../src/cli/index.ts", { parentURL, tsconfig })`. I empirically verified
(before writing a line) that tsx resolves the `@contracts`/`@core` tsconfig path
aliases end-to-end — a probe imported the real `src/index.ts` and ran
`interpret()` successfully. `bin` passes the project `tsconfig.json` explicitly so
the aliases resolve regardless of the caller's cwd (`node bin/klein.mjs`, `npx`,
or a global install). Paths are resolved from `import.meta.url`, not cwd.

## 4. A structural decision: `main` lives in `main.ts`, not `index.ts`

My brief's approach sketch put `main` in `src/cli/index.ts`. The scaffold's
`vitest.config.ts`, however, **excludes `src/**/index.ts` from coverage** as
"re-export barrels." I confirmed this empirically: in the baseline coverage report
no `index.ts` appears at all (the `cli` group listed only `cli.ts` + `repl.ts`).

Putting `main` in `index.ts` would therefore have made the dispatch **silently
uncovered**, violating this task's own success criteria ("`main` dispatch tested
for both paths" + "≥90% line coverage of `src/cli`"). I resolved toward the
brief's *intent and success criteria* rather than its literal file placement:

- `src/cli/main.ts` — the dispatch logic (covered; **100%**).
- `src/cli/index.ts` — a pure barrel re-exporting `main` (correctly excluded).

The public surface is identical: `import { main } from "src/cli"` still works.
`src/cli/main.ts` is a new file, but it is within *this* node's ownership scope
(no other child owns it — `facade`=`src/index.ts`, `cli_runner`=`src/cli/cli.ts`,
`repl`=`src/cli/repl.ts`), so it introduces no ownership collision and needed no
plan amendment (it is an internal implementation choice, not a DAG/contract
change). This choice is also robust to the glob's interpretation: a pure barrel is
fine whether or not it is excluded, and `main.ts` is counted either way.

## 5. Verification — all gates run for real, all green

Toolchain: Node v24.18.0, from the repo root.

| Gate | Command | Result |
|---|---|---|
| Build (type-check) | `npm run build` (`tsc -p tsconfig.build.json`) | exit 0 |
| Typecheck (full) | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` (`eslint .`) | exit 0, 0 findings |
| Format | `npm run format:check` (`prettier --check .`) | "All matched files use Prettier code style!" |
| Tests | `npm test` (`vitest run`) | **517 passed** (24 files); was 511 before (+6 in `bin.test.ts`) |
| Coverage | `npm run coverage` | thresholds (90/90/90/90) pass |

**Coverage of `src/cli` (the gated number): 99.03% lines** — comfortably ≥ 90%.

```
 cli      | %Stmts | %Branch | %Funcs | %Lines
  cli.ts  | 100    | 95.77   | 100    | 100
  main.ts | 100    | 100     | 100    | 100
  repl.ts | 97.76  | 95.55   | 100    | 97.76
All files | 98.7   | 97.08   | 99.42  | 98.7
```

`main.ts` is **100%** on all four axes; `bin.test.ts` exercises both `&&` branches
and both runner sub-cases (file, `--version`-at-a-TTY, and empty-argv+piped-stdin).

**End-to-end through the real `bin` (not just unit tests):**

- `node bin/klein.mjs /tmp/ok.kl` → prints `15`, exit `0` (loop + `println`).
- `node bin/klein.mjs /tmp/bad_parse.kl` → `error[E2003]…` with source snippet +
  caret, exit `1`.
- `node bin/klein.mjs /tmp/bad_runtime.kl` → `error[E3001]…` with a stack
  traceback, exit `1`.
- `node bin/klein.mjs --version` → `0.1.0`, exit `0`; `--help` → usage, exit `0`.
- `printf 'println(6 * 7);\n' | node bin/klein.mjs` → `42`, exit `0` (piped stdin
  routes to the runner, not the REPL).
- `node bin/klein.mjs --eval 'println("eval works");'` → `eval works`, exit `0`.
- **REPL over a real pseudo-terminal** (`script -qec 'node bin/klein.mjs'`):
  banner + `klein>` prompts, persistent state (`let a=20; let b=22; a+b;` → `42`),
  `.help` prints help, `.exit` quits cleanly. Confirms "no args ⇒ working REPL."

## 6. Ownership & contract discipline

- `contracts/` **unmodified** (never written to).
- Sibling-owned files (`src/index.ts`, `src/cli/cli.ts`, `src/cli/repl.ts`)
  **unmodified**; I only imported their public exports.
- Owned outputs authored: `src/cli/index.ts`, `bin/klein.mjs`,
  `tests/cli/bin.test.ts`, this `COMPLETE.md`, plus the in-scope `src/cli/main.ts`
  (see §4).
- Zero new runtime dependencies. `bin` uses only Node built-ins (`fs`, `path`,
  `url`, `readline`) + `tsx` (already present, and the project's designated
  runtime). `cli_runner` justified its hand-rolled argv parser (no dep); I added
  none.

## 7. Deferred debt / honest flags (no silent plugs)

1. **Facade (`src/index.ts`) coverage is not counted — out of my scope, flagged
   for `integration`.** The same `vitest.config.ts` `src/**/index.ts` exclusion
   that drove §4 also excludes the **facade**, whose `interpret()` carries real
   logic. So the project-level "≥90% on `src/`" number does **not** currently
   include `interpret()`. I did **not** silently fix this: I may not modify
   `src/index.ts` (sibling-owned), and changing the scaffold-owned
   `vitest.config.ts` exclusion is a cross-cutting change affecting the whole
   project's coverage accounting — that belongs to the `integration` hub (whose
   job is exactly whole-project integrity), or to an additive amendment. **Action
   for `integration`**: either tighten the coverage `exclude` to only *genuine*
   barrels (so logic-bearing `src/index.ts` is counted — `interpret` is already
   tested by `facade`'s `tests/cli/interpret.test.ts`, so this should stay green),
   or confirm the exclusion is intended and record it. `interpret()` *is* tested;
   it is only the *accounting* that omits it.
2. **REPL line editing.** `bin`'s `readline` uses `terminal: false` (the REPL
   writes its own prompts; this avoids double-prompting and keeps behavior
   deterministic). Cost: no arrow-key line editing / history at the interactive
   prompt. Acceptable for a first REPL; a future enhancement could adopt
   `terminal: true` with prompt handoff, or the Node `repl`-style editing.
3. **`bin/klein.mjs` is intentionally untested** (thin shim, `.mjs`, outside
   `src/`, excluded from coverage). All testable logic lives in `main` + the
   siblings, each covered via injected I/O — this is the stated design, not a gap.

## 8. Subtree success criteria (from `../_GLOBAL.md` §7) — status

- [x] `interpret()` correct for ok / lex / parse / runtime cases — `facade` tests, green.
- [x] `node bin/klein.mjs <file>` runs & prints; bad program → rendered,
      source-anchored diagnostic + non-zero exit (verified live).
- [x] REPL: shared state, multiline, readable non-fatal errors, `.exit`/`.help`
      (unit tests + live pty session).
- [x] `tsc` (build + typecheck), `eslint`, `prettier --check` clean; no `any` in
      the public surface.
- [x] `tests/cli/**` cover facade + argv + REPL + dispatch; **≥90% line coverage
      of `src/cli`** (99.03%, verified).
- [x] `contracts/` unmodified; child ownership disjoint and respected.

The `cli` subtree composes into a runnable, verified whole and meets the quality
bar. The project-level `integration` hub can consume this result; the only item
it must adjudicate is the facade-coverage-accounting flag in §7.1.
