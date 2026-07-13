# COMPLETE — `runtime.evaluator` (tree-walking Interpreter + runtime barrel)

**Task**: implement the tree-walking `Interpreter` (`contracts/values.ts#Interpreter`),
compose the completed `runtime.values` + `runtime.environment` modules, assemble
the runtime subtree barrel, and prove the whole runtime works end-to-end against
the real lexer + parser.

**Status**: COMPLETED · **Decompose evaluation**: Atomic.

---

## 1. Decompose evaluation (recorded, as the brief required)

The brief named three candidate concerns (expression eval; statements &
control flow; call machinery) and asked for an honest atomicity call. Applying the
kernel triggers to my actual brief:

| Trigger / test | Outcome | Basis |
|---|---|---|
| Token-based | clears | Inputs (contract + `values`/`environment` + lexer/parser for tests) ≪ 50% context |
| Single-Responsibility (conjunction) | **passes (atomic)** | Faithful description is "evaluate the AST to a `Value`" — one verb, one output kind; no "X *and* Y" of distinct verbs. Expression/statement/call eval are all "recursively evaluate a node," dispatched by `kind` |
| Distinct Concerns (parallel specialists) | **does not fire** | The three groupings are cases of ONE mutually-recursive visitor sharing private state (`callStack`, `depth`, the `Signal` type, the eval dispatch), all writing the single `Interpreter` class. They form a *cycle* (`CallExpression` → apply → execute body block → statements → expressions → `CallExpression`), not an acyclic precursor→synthesis DAG; they cannot be independently completed or verified by parallel specialists |
| Output Size | fires | `interpreter.ts` + tests exceed 400 lines — but the **weakest** signal; per Trigger Precedence it cannot override passing concern tests, and the kernel explicitly permits judgment to push through a *pure size* signal on a genuinely single-responsibility task |
| Tool-call envelope | ~30 calls | Well below the 100-call collapse |

**Verdict: Atomic.** A tree-walking evaluator is irreducibly one recursive
responsibility; the enumerated "concerns" are pedagogical case-groups within one
algorithm, exactly as the brief acknowledged ("one cohesive mutually-recursive
visitor is a defensible single responsibility"). This is a mechanical
trigger outcome, not a coupling-overhead preference.

## 2. What was built (owned outputs — no cross-writes)

- **`src/runtime/interpreter.ts`** — the `Interpreter` class implementing the
  contract. A mutually-recursive visitor: `evalExpression` (all 14 expression
  kinds), `execStatement` (all 10 statement kinds), and call machinery
  (`callValue` / `applyFunction` / `applyBuiltin`). Composes the **real**
  `./values` (constructors, `isTruthy`, `valuesEqual`, `stringify`) and
  `./environment` (scope chain) — never reimplements them.
- **`src/runtime/index.ts`** — the runtime subtree barrel: `export * from
  "./values"` + `Environment` + `Interpreter`, so `stdlib`/`cli` import the whole
  runtime surface from one place. (Pure re-export barrel; coverage-excluded.)
- **`tests/runtime/interpreter.test.ts`** — 63 tests driven through the **real**
  lexer + parser (never a hand-mocked AST); assertions key off `ErrorCode` /
  canonical `stringify`, never message text.

### Design highlights
- **Control flow as internal signals.** `return` / `break` / `continue` are a
  `Signal` discriminated union threaded up the statement chain — never `throw`n,
  never observable to callers. A function call converts a `return` signal into its
  value; loops consume `break`/`continue`. The only thing that escapes the
  evaluator is a `RuntimeErr` on a genuine fault.
- **Closures & lexical scope.** A user call runs the body in a **fresh child of
  the closure** (not the call site). `FunctionValue` closes over its defining
  `Environment`; the counter/adder tests prove capture-by-reference and closure
  independence.
- **Hoist-by-value.** Function declarations are hoisted into their enclosing scope
  before execution, so forward references and mutual recursion resolve regardless
  of textual order (`is_even`/`is_odd` test).
- **Maintained Klein call stack.** A live `StackFrame[]` (innermost last) is pushed
  per call and snapshotted onto every thrown `RuntimeErr` — including
  `UndefinedVariable` surfacing from `Environment` and errors thrown by injected
  builtins (attached via `withStack` at the throw boundary). A base `<script>`
  frame ensures even top-level faults carry stack content.
- **StackOverflow guard** raises before the host JS stack blows (`maxCallDepth`,
  default 1000; tests use a small limit for determinism).
- **Builtin injection only.** Builtins arrive via `InterpreterOptions.builtins`
  and are installed into `globals`; **no stdlib is hardcoded** (default: none —
  a test proves `print` is `UndefinedVariable` by default). Injected builtins run
  through `BuiltinContext` (`write` + re-entrant `call`); a higher-order builtin
  using `ctx.call` is proven to work with no stdlib present.

## 3. Implementation-defined semantics fixed here (per `docs/LANGUAGE.md`)

The spec explicitly defers several fine-grained points to the runtime; the choices
made (all documented in-code) for downstream (`stdlib`, `cli`, `integration`):

- **Bad-operand code split.** `InvalidOperand` (E3010) when an operand kind is
  categorically unacceptable for the operator (`true + 1`, `[] * 2`, `-"x"`,
  `1 < true`); `TypeMismatch` (E3002) when both operands are individually
  acceptable but mismatched (`1 + "x"`, `1 < "x"`).
- **Ordered comparison of strings** is supported (lexicographic by UTF-16 code
  unit); comparing unsupported kinds faults as above.
- **Object read of an absent key via `[...]`** behaves identically to `.` →
  `PropertyNotFound` (chosen for consistency; the spec allowed either this or
  `null`).
- **String indexing** is not supported by the evaluator (a string is "neither an
  array nor an object" → `InvalidIndexTarget`); string element/length access is
  left to the standard library, as the spec anticipates.

### ⚠️ Spec inconsistency resolved (flag for `integration`/`cli`)
`docs/LANGUAGE.md#logical-operators` gives the example `0 || "x"` yields `"x"`,
which only holds if `0` is falsy — but Klein's truthiness rule (heavily emphasized,
and already implemented in the completed `runtime.values#isTruthy`) makes **`0`
truthy**. The evaluator follows the truthiness rule and `isTruthy` (the single
source of truth), so `0 || "x"` yields `0`. The `||`/`&&` example in the spec is
internally inconsistent with its own truthiness section; the truthiness rule
governs. Tests assert the correct behavior (`false || "x"` → `"x"`; `1 && 2` → `2`;
short-circuit non-evaluation of the right operand). A docs correction is a matter
for a docs-owning task, not the evaluator.

## 4. Verification (all green)

- `npm run typecheck` (tsc strict) — clean.
- `npm run build` (tsconfig.build.json) — clean.
- `npm run lint` (ESLint, type-aware; `no-explicit-any`, exhaustiveness) — clean.
- `npm run format:check` (Prettier) — clean.
- `npm test` — **352 passed** (63 new evaluator tests) across all 12 suites.
- `npm run coverage` — thresholds (≥90% lines/branches/functions/statements) met:
  aggregate **98.3 / 96.8 / 99.3 / 98.3**; `interpreter.ts` **96.4 / 94.7 / 97.1 /
  96.4**.
- No `any` in public surface; discriminated unions handled with exhaustive
  `switch` + `never`-assertion default arms (subset-dispatch on `Value.kind` uses
  narrowing `if` chains so the scaffold ESLint exhaustiveness rule stays green).
- `contracts/` unmodified; only the three owned outputs were written; the runtime
  ownership partition (`values`/`environment`/`evaluator`) is respected with no
  cross-writes.

## 5. Handoff to downstream

- `runtime` (parent) can synthesize: `src/runtime/**` builds, lints, formats, and
  tests clean at ≥90% coverage; `_MANIFEST` identity `implements: [Value,
  Environment, Interpreter]` holds.
- `stdlib` imports builtins' calling convention (`BuiltinValue` / `BuiltinContext`)
  and installs its roster via `InterpreterOptions.builtins`; it should import the
  runtime surface from the barrel `src/runtime` (or `../runtime`).
- `cli` constructs `new Interpreter({ write, builtins, maxCallDepth })`, calls
  `run(program)`, and catches the first `RuntimeErr` for its facade (per root §4);
  `RuntimeErr.callStack` (innermost last) is populated for diagnostics.
