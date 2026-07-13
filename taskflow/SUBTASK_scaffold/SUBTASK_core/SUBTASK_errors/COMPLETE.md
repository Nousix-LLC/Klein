# COMPLETE — `scaffold.core.errors` (concrete Klein error classes)

**Task**: Implement the concrete `KleinError` classes every Klein pipeline stage
throws — real `Error` subclasses that are also structurally source-anchored — plus
unit tests. **Decompose evaluation**: Atomic (one module + its co-located tests; a
single responsibility — concrete error classes). Reached independently against my
own brief (every trigger cleared, both concern tests passed), matching the parent
hub's expectation. **Status**: COMPLETED.

Every success criterion below was **proven by running the real toolchain command**
(Node v24.18.0), not asserted.

---

## 1. Owned outputs delivered (exclusive — only these two paths)

| File | Role |
|---|---|
| `src/core/errors.ts` | Abstract `KleinErrorBase` + concrete `LexicalError` / `SyntaxErr` / `RuntimeErr` |
| `tests/core/errors.test.ts` | Vitest unit tests (10 cases) keyed off `ErrorCode` + structured fields |

Wrote **nothing** outside those two paths. Did not modify `contracts/`, `span.ts`,
any config/CI file, docs, or any sibling's files (`git status --porcelain` clean;
whole-repo lint/format still green).

## 2. Public surface (implements `contracts/errors.ts#KleinError` literally)

Contract types imported literally from `@contracts` (never re-declared); inline
`type`-imports satisfy `consistent-type-imports`.

| Export | Shape | Semantics |
|---|---|---|
| `KleinErrorBase` (abstract) | `extends Error implements KleinError` | Holds `code`/`span` + inherited `message`; abstract `phase`; default `toDiagnostic()`. Protected ctor so it can't be instantiated directly. |
| `LexicalError` | `(code, message, span)` | Fixes `phase = "lexical"`, `name = "LexicalError"`. |
| `SyntaxErr` | `(code, message, span)` | Fixes `phase = "syntax"`, `name = "SyntaxErr"`. |
| `RuntimeErr` | `(code, message, span, callStack?)` | Fixes `phase = "runtime"`, `name = "RuntimeErr"`; carries optional Klein `callStack: readonly StackFrame[]`; overrides `toDiagnostic()` to thread `callStack` → `Diagnostic.stack`. |

Every instance: `instanceof Error` **and** `instanceof` its concrete class **and**
structurally satisfies `KleinError` (interoperates with `throw`/`catch`/JS stack).

## 3. Design decisions (documented, not confabulated — per hub §9)

- **Real `Error` subclasses.** Each `extends Error` and sets `this.name` in its
  constructor (assigns the inherited mutable `Error.name`, which satisfies
  `KleinError`'s `readonly name` — no `override`/readonly-conflict). The base runs
  `Object.setPrototypeOf(this, new.target.prototype)` (the canonical `extends
  Error` idiom): a no-op on the native ES2022 target, but keeps `instanceof` correct
  if this is ever downleveled.
- **`callStack`, not `stack`.** The brief asks `RuntimeErr` to carry the Klein call
  stack "distinct from the JS `Error.stack`." The native `Error` already owns
  `stack` typed as `string`, and TypeScript forbids re-typing an inherited property
  to `readonly StackFrame[]` (TS2416). The boring, conventional resolution: expose
  the Klein frames as **`callStack`** and map them onto the contract's
  `Diagnostic.stack` field inside `toDiagnostic()`. The native `Error.stack` string
  is left untouched (test proves it).
- **`exactOptionalPropertyTypes` honored.** `callStack` is assigned only when
  provided (`if (callStack !== undefined)`), and `toDiagnostic()` omits `stack`
  entirely when there is no call stack — so an absent stack is absent from the
  diagnostic, never `stack: undefined`.
- **Severity fixed to `"error"`.** These classes are hard errors; a single module
  const `SEVERITY: Severity = "error"` feeds every diagnostic.
- **No speculative surface.** No phase↔code validation switch was added: each class
  fixes its own `phase`, so there is no branch on `ErrorPhase`/`ErrorCode` to make
  exhaustive. No `any` anywhere.
- **Span geometry reused, not re-derived.** Tests build spans via `./span`'s
  `makePosition`/`makeSpan` (the `span` dependency's helpers); `errors.ts` only
  stores the `Span` it is handed.

## 4. Proof the gate is green (commands actually run, Node v24.18.0)

```
npm run build            -> exit 0  (tsc -p tsconfig.build.json, strict; errors.ts present)
npm run lint  (eslint .) -> exit 0  (whole repo, incl. src/core/errors.ts + test)
npm run format:check     -> exit 0  ("All matched files use Prettier code style!")
npx vitest run tests/core/errors.test.ts        -> exit 0  (10 passed)
npx vitest run --coverage                        -> exit 0  (38 passed across 3 suites)
```

Coverage on `src/core/errors.ts` (from the full-suite v8 report):

```
errors.ts | % Stmts 100 | % Branch 100 | % Funcs 100 | % Lines 100
```

≥90% bar cleared on all four metrics (100%). The global gate also passed
(Statements 100%, Branches 94.73%, Functions 100%, Lines 100% — thresholds ≥90).

## 5. Conventions followed (hub §5 / tooling `COMPLETE.md` §5)

- `@contracts` alias for contract types; **extensionless** relative import of the
  module-under-test from the test (`../../src/core/errors`) and of `./span` deps.
- Vitest API imported explicitly (`import { describe, it, expect } from "vitest"`
  — no globals).
- All strict flags honored; no `any` in the public surface.

## 6. How this composes downstream (handoff)

- **`scaffold.core.diagnostic`** (sibling, independent) renders any
  `KleinError.toDiagnostic()` output; its `Diagnostic` shape matches exactly what
  these classes emit (severity/phase/code/message/span, plus `stack` for a
  `RuntimeErr` that carries a `callStack`).
- **`scaffold.core.synthesis`** will barrel-export `LexicalError`, `SyntaxErr`,
  `RuntimeErr`, and `KleinErrorBase` from `src/core/index.ts` and prove the three
  core modules compose. Downstream stages can catch any Klein error via
  `catch (e) { if (e instanceof KleinErrorBase) … }` and reduce it with
  `e.toDiagnostic()`.
- **Every later pipeline stage** (lexer → `LexicalError`, parser → `SyntaxErr`,
  runtime → `RuntimeErr`) throws these with a `Span` built from `./span` helpers.

## 7. Success criteria — all met

- [x] `npm run build`, `npm run lint`, `npm run format:check` green (repo-wide); no `any` leak.
- [x] `tests/core/errors.test.ts` passes under `vitest run`; `src/core/errors.ts` 100% covered (≥90% bar).
- [x] Instances are real `Error` subclasses **and** structurally satisfy `KleinError`; catchable, carry their span.
- [x] `toDiagnostic()` produces a `Diagnostic` matching the contract shape exactly (incl. `RuntimeErr` stack passthrough, omitted when absent).
- [x] Tests key off `ErrorCode` + structured fields, never message text.
- [x] `contracts/`, `span.ts`, config, docs, and siblings unmodified; wrote only the two owned files.
