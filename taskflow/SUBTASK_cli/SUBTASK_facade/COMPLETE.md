# COMPLETE — `SUBTASK_facade`: `interpret()` facade + public API barrel

**Task**: `facade` (slug) · **Decompose evaluation**: Atomic · **Status**: completed
**Depends on**: — (composed the completed `src/**`) · **Dependents**: `cli_runner`, `repl`, `synthesis`

## What was produced

- **`src/index.ts`** — the package's public library entry. Two responsibilities,
  one cohesive surface:
  1. `interpret(source: string, options?: InterpretFacadeOptions): InterpretOutcome`
     — the single facade that wires the **real, completed** pipeline
     `Lexer → Parser → Interpreter` (+ stdlib builtins) into one discriminated
     outcome. It never throws for a Klein-level fault.
  2. The deliberate public API barrel — the contract *types* a consumer needs
     (facade result types, diagnostic vocabulary, value model, builtin calling
     convention) plus the concrete error *classes* `LexicalError` / `SyntaxErr` /
     `RuntimeErr` from `@core`, and the `ErrorCode` / `ValueKind` enums.
- **`tests/cli/interpret.test.ts`** — 20 tests, all green, driven end-to-end
  through the real pipeline. Assertions key off structured `ErrorCode`s /
  `ValueKind`s and `ok` / `value` / `diagnostics`, never message text.

Ownership respected: only the two declared outputs were authored. No `src/cli/**`,
`bin/**`, or `src/cli/index.ts` were created (those belong to sibling tasks).
`contracts/` was imported literally and left unmodified.

## How `interpret()` behaves (the contract it realizes)

1. **Lex** then **parse** — both stages are error-tolerant and always return.
2. **Merge** lexical + syntax errors into `Diagnostic[]` in **source order**
   (by span start offset, then end offset).
3. **Short-circuit**: if any front-end diagnostics exist → `{ ok: false,
   value: null, diagnostics }` **without running** the program.
4. **Run** otherwise: construct `Interpreter` with the resolved
   `{ write, builtins, maxCallDepth }` and `.run(program)`; a thrown `RuntimeErr`
   is converted via `toDiagnostic()` into `{ ok: false, value: null,
   diagnostics: [d] }`. A non-`RuntimeErr` throwable (a genuine host bug) is
   **re-thrown** — the facade owns only Klein-level faults.

Defaults: `sourceName = "<script>"`, `write = process.stdout.write` (wrapped to a
`void`-returning sink), `builtins = defaultBuiltins()` (full stdlib). Under
`exactOptionalPropertyTypes`, `maxCallDepth` is forwarded only when supplied, so
an omitted value lets the interpreter apply its own default. No `any` in the
exported signature.

## Verification (all green)

| Gate | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` (typecheck, strict) | 0 errors |
| `tsc -p tsconfig.build.json --noEmit` (build) | 0 errors |
| `eslint .` (whole project) | 0 errors |
| `prettier --check` (owned files) | clean |
| `vitest run` (full suite) | **457 passed / 21 files** — no regressions (was 456) |
| Facade tests (`tests/cli/interpret.test.ts`) | 20 passed |
| Coverage of `src/index.ts` (measured with the barrel-glob overridden) | **98.3% lines, 100% funcs, 93.75% branches** |

Success criteria from `_BRIEF.md`, each met:
- ✅ Correct `InterpretOutcome` for **ok**, **lex-error**, **parse-error**, and
  **runtime-error** inputs, asserted against structured `ErrorCode`s and
  `ok`/`value`/`diagnostics` — never message text.
- ✅ Injected `write` sink captures `print`/`println` output deterministically
  (`"a b" + "c\n"`), and the default sink path is covered via a controlled
  `process.stdout.write` spy.
- ✅ `tsc` / lint / format clean; no `any` in the public surface.

## Interface facts downstream siblings can rely on

- Import the facade + public types from the package root barrel `src/index.ts`.
  `interpret` is the entry `cli_runner` and `repl` build on; render diagnostics
  through `@core`'s `DiagnosticFmt` / `formatDiagnostic` (unchanged, owned by
  scaffold) — the facade returns structured `Diagnostic[]`, it does not render.
- The facade re-exports (deliberate public surface, nothing more): `interpret`;
  classes `LexicalError`, `SyntaxErr`, `RuntimeErr`; enums `ErrorCode`,
  `ValueKind`; and the types `InterpretOutcome`, `InterpretFacadeOptions`,
  `Diagnostic`, `KleinError`, `ErrorPhase`, `Severity`, `StackFrame`, `Value` (+
  its variants), `BuiltinValue`, `Arity`, `BuiltinImpl`, `BuiltinContext`.
  Internal machinery (`Lexer`/`Parser`/`Interpreter`, token/AST vocab, value
  constructors) is intentionally NOT re-exported.

## Handoff note for `synthesis` / `integration` (config observation — NOT a blocker)

The scaffold's `vitest.config.ts` coverage `exclude` uses the glob
`src/**/index.ts` to drop pure re-export barrels. That glob **also matches the
logic-bearing `src/index.ts`**, so the facade is omitted from the default
coverage *report* — which is contrary to hub §3 ("files that carry logic (facade,
cli, …) are NOT excluded"). This is a measurement/config issue, not a
correctness issue: the facade is genuinely covered at ≥90% (98.3% lines, verified
by overriding the glob on the CLI, see the table above), and every success
criterion is independently satisfied by the passing tests.

I did **not** edit `vitest.config.ts`: it is a completed sibling's (`scaffold`)
owned output and disjoint-ownership + amendment-boundary rules forbid modifying a
COMPLETED task's outputs. The subtree/project coverage gate owner (`synthesis`
for `src/cli`, `integration` for `src/`) should tighten the exclude so pure
barrels are still dropped but `src/index.ts` is measured — e.g. exclude
`src/**/*/index.ts` (require at least one subdirectory) or list the barrel files
explicitly. Flagging per the kernel's "document the gap rather than silently
diverge" guidance.

## Methodology note

The software methodology bundle was unavailable at dispatch
(`methodology_glob` → `agent_domain_unset`), consistent with root `_GLOBAL.md`
§8. Methodology was taken from `contracts/` + the hub docs + this brief, and the
work deliberately follows standard interpreter-facade construction (a thin,
boring, testable wiring layer over the completed stages).
