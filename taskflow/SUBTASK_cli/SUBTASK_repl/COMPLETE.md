# COMPLETE — `SUBTASK_repl` (interactive REPL, `startRepl`)

**Task**: Produce `src/cli/repl.ts` — an injectable `startRepl(io)` implementing an
interactive read-eval-print loop with a persistent global environment across
entries, multiline continuation on unbalanced input, readable non-fatal error
rendering, and `.exit` / `.help` meta-commands — plus its test suite.

**Decompose evaluation**: `Atomic`. One responsibility (build one cohesive module +
its unit test), one kind of output. Every decomposition trigger cleared and both
concern tests passed against this brief.

## Owned outputs (disjoint — nothing else touched)

- `src/cli/repl.ts` — the REPL module (exports `startRepl` and the `ReplIo` seam).
- `tests/cli/repl.test.ts` — 25 scripted-session tests.

Did **not** create `src/cli/cli.ts`, `src/cli/index.ts`, `bin/**`, or
`src/index.ts` (those belong to `cli_runner` / `synthesis` / `facade`). `contracts/`
unmodified.

## Public surface

```ts
export interface ReplIo {
  readonly stdout: (text: string) => void;   // prompts, banner, echoed values
  readonly stderr: (text: string) => void;   // rendered diagnostics
  readonly nextLine: () => Promise<string | null>; // one line, no trailing \n; null = EOF
  readonly color?: boolean;                   // ANSI colour in diagnostics (default false)
}
export function startRepl(io: ReplIo): Promise<void>;
```

All I/O is injected — nothing touches the real `process`. Binding real
stdin/stdout via `readline` is `bin/klein.mjs`'s job (`synthesis`), per `_GLOBAL.md`
§6. Prompts and echoed values go through `io.stdout`; diagnostics through
`io.stderr`; input through `io.nextLine`.

## Key design decisions (and their justification)

1. **Persistent state = one long-lived `Interpreter` (brief option (a)).** Option
   (b) — threading a persistent environment through repeated `interpret()` facade
   calls — is *not actually available*: the facade constructs a **fresh**
   `Interpreter` per call (`src/index.ts`), so it cannot carry state between
   entries. Option (a) is therefore the correct and cleanest mechanism:
   `Interpreter.run()` executes a program's top-level statements directly in
   `this.globals` (`src/runtime/interpreter.ts`), so a single long-lived interpreter
   accumulates every `let` / `fn` / assignment across entries for free. Because we
   hold the interpreter, we drive the front end (`Lexer` → `Parser`) ourselves and
   feed each parsed `Program` to `run()`. This is **reuse, not reimplementation**:
   rendering goes through `@core`'s `formatDiagnostic`, value formatting through the
   runtime's `stringify`; the only facade logic mirrored is the trivial
   "merge front-end diagnostics in source order, short-circuit before running,"
   which is inherent to driving a stateful pipeline.

2. **Result echoing suppresses `null`.** A non-`null` result is echoed via
   `stringify`; a `null` result is suppressed (declarations, loops,
   assignments-to-null, and output-only calls like `println(...)` all evaluate to
   `null`, and echoing `null` after each would be noise). Documented cost: typing a
   bare `null` echoes nothing — an acceptable trade for a clean session, and exactly
   the behavior the brief asked for ("skip printing `null` for statements that
   produce nothing meaningful").

3. **Multiline continuation is delimiter-driven, and respects a real lexer fact.**
   Completeness reuses the `Lexer` (never re-scanning strings/comments): bracket
   nesting is counted over the token stream, and the two open-delimiter cases are
   split because **Klein block comments span newlines but string literals do NOT**
   (the lexer ends a string at a newline — `scanString`). So an unterminated *block
   comment* → keep reading; an unterminated *string* → a genuine error that is run
   and reported (never waited on — this avoids a hang). A stray closer (`}` with no
   opener) is likewise a real error, run immediately, not a continuation.

4. **Meta-commands only at entry start.** `.exit` / `.help` are recognized only when
   the entry buffer is empty, so a `.exit` appearing mid-continuation is content, not
   the quit command. A blank line at the `...` continuation prompt cancels an
   in-progress entry (the escape hatch for input that will never balance); EOF
   (`nextLine → null`) ends the session cleanly, like `.exit`.

5. **Host faults propagate.** A Klein-level fault (lexical/syntax/runtime) is rendered
   and the loop continues; a non-Klein host throwable (a bug in a builtin or the
   runtime) is re-thrown rather than swallowed, so real defects are not hidden.

## Success criteria — all met

- [x] Scripted multi-line session shows **shared state** (binding on one line visible
      later) — `persistent global state` tests (let/reassignment/function).
- [x] Multiline continuation assembles an unbalanced entry across lines then
      evaluates it — array-literal and function-body tests; block-comment test.
- [x] A runtime/syntax/lexical error mid-session renders a readable diagnostic and the
      session continues — `errors do not end the session` tests (keyed off structured
      `ErrorCode`s, never message text).
- [x] `.exit` ends the loop; `.help` prints usage; post-`.exit` input ignored; EOF ends
      cleanly.
- [x] No `any` in exported signatures (`ReplIo`, `startRepl` fully typed).

## Verification (run at completion)

Node 24.18.0 (via nvm), local `node_modules/.bin`:

- `tsc -p tsconfig.json --noEmit` — **clean** (strict mode, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, etc.).
- `eslint src/cli/repl.ts tests/cli/repl.test.ts` — **clean**.
- `prettier --check` on both files — **clean**.
- `vitest run tests/cli/repl.test.ts` — **25/25 pass**.
- Coverage of `src/cli/repl.ts` — **97.76% lines, 95.34% branches, 100% functions**
  (≥ 90% bar). The only uncovered lines are the defensive host-fault rethrow (not
  reachable through `startRepl`, since builtins can't be injected via `ReplIo`) and a
  diagnostic-sort tie-breaker.
- Full repo suite `vitest run` — **511/511 pass** (no regression to siblings; ownership
  disjoint).

## Interface note for `synthesis`

`startRepl(io: ReplIo): Promise<void>` matches the `_GLOBAL.md` §5 contract. `bin/klein.mjs`
should build a `ReplIo` from `readline` (prompt-agnostic line source that resolves `null`
on `close`/EOF), `process.stdout.write` / `process.stderr.write`, and a `color` flag
(e.g. `process.stdout.isTTY`). The dispatch `main` (no-args ⇒ REPL) and `bin` wiring remain
`synthesis`'s responsibility.
