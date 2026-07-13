# Klein `runtime` subtree — AST → Value (values, environment, evaluator)

**Subtree hub (`_GLOBAL.md`).** Shared, write-once context for every task in the
`runtime` decomposition. Each child reads this **plus** the project root hub
`../_GLOBAL.md` **plus** its own `SUBTASK_*/_BRIEF.md`, and treats `../contracts/`
and `../src/core`, `../src/lexer`, `../src/parser` as **read-only** ground truth.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Parent task**: `runtime`
(depends on `scaffold`, `parser` — both COMPLETE; dependent: `stdlib`).

---

## 1. Why `runtime` decomposed (trigger evaluation)

`SUBTASK_runtime/_BRIEF.md` explicitly enumerates **three cohesive-but-distinct
concerns** and asks for an honest atomicity evaluation. Applying the kernel
triggers to the actual brief:

| Trigger family | Outcome | Basis |
|---|---|---|
| Scope-Based / enumerated-concerns | **FIRES** | Brief names 3 concerns: value system, environment, evaluator |
| Distinct Concerns Test (parallel) | **FIRES** | Value-system and environment can be built independently by different specialists; evaluator synthesizes both |
| Single-Responsibility Rule | **FIRES** | "value system AND environment AND evaluator" — three verbs, three kinds of output |
| Output Size | **FIRES (MUST)** | Evaluator alone ≫400 lines; combined `src/runtime/**` + `tests/runtime/**` at ≥90% coverage far exceeds threshold |
| Tool-call envelope | **FIRES** | 4 source modules + comprehensive tests + build/lint/test iterations ≫15 calls |

Output-size framing ("one owned subtree `src/runtime/**`") MUST NOT override the
fired scope/concern triggers (Trigger Precedence). **Verdict: decompose.**

## 2. Subtree shape (precursor ∥ precursor → synthesis)

```
values ──────┐
             ├──▶ evaluator   (synthesis hub of the runtime subtree)
environment ─┘
```

| Child (task id) | Responsibility | Depends on | Owned outputs |
|---|---|---|---|
| `runtime.values` | Value system: constructors for every `ValueKind`, structural `==` equality, truthiness, canonical stringifier | `scaffold`, `parser` | `src/runtime/values.ts`, `tests/runtime/values.test.ts` |
| `runtime.environment` | `Environment` lexical scope chain (`define`/`get`/`assign`/`has`/`child`, shadowing, `UndefinedVariable`) | `scaffold`, `parser` | `src/runtime/environment.ts`, `tests/runtime/environment.test.ts` |
| `runtime.evaluator` | Tree-walking `Interpreter` over statements/expressions + control-flow signals + closures + call stack + subtree barrel | `runtime.values`, `runtime.environment`, `parser` | `src/runtime/interpreter.ts`, `src/runtime/index.ts`, `tests/runtime/interpreter.test.ts` |

`values` and `environment` are independent (parallel). `evaluator` is the
**synthesis hub**: it composes both into a working `Interpreter`, owns the runtime
subtree barrel `src/runtime/index.ts`, and proves the whole runtime works
end-to-end against the **real** lexer+parser. It MAY itself re-run its own
atomic-vs-decompose evaluation and sub-decompose (e.g. expression-eval vs
statement/control-flow vs call-machinery) — its brief says so honestly.

### Ownership partition (disjoint subdivision of `_MANIFEST.yaml` → ownership.runtime)

The manifest assigns `src/runtime/**` + `tests/runtime/**` to `runtime`
collectively. The children partition it with **no overlap**:
- `runtime.values` → `src/runtime/values.ts`, `tests/runtime/values.test.ts`
- `runtime.environment` → `src/runtime/environment.ts`, `tests/runtime/environment.test.ts`
- `runtime.evaluator` → `src/runtime/interpreter.ts`, `src/runtime/index.ts`, `tests/runtime/interpreter.test.ts`

`../contracts/` stays read-only for all. No child writes outside its subtree, and
none writes another child's file.

### Resumption / synthesis

`runtime` remains SUSPENDED until all three children reach terminal state. On
resume, `runtime` verifies the composed `src/runtime` builds (`tsc`), lints/formats
clean, its tests pass at ≥90% coverage, and the `_MANIFEST` identity
`implements: [Value, Environment, Interpreter]` holds — then reports completion so
`stdlib` (which depends on `runtime`) proceeds. `stdlib` is **not** rewired: it
depends on `runtime`, which stays non-terminal until this subtree resolves.

## 3. The contract this subtree realizes (`../contracts/values.ts`) — READ-ONLY

Import literally (never paraphrase, never edit `contracts/`):

```ts
import {
  Value, ValueKind, NullValue, BooleanValue, NumberValue, StringValue,
  ArrayValue, ObjectValue, FunctionValue, BuiltinValue, Arity,
  Environment, BuiltinContext, BuiltinImpl,
  Interpreter, InterpreterOptions,
} from "@contracts";        // or a relative import to ../contracts — both resolve
```

Contract facts binding every child:
- **`Value`** is a discriminated union tagged by `kind: ValueKind` (string enum
  values: `"null"`, `"boolean"`, `"number"`, `"string"`, `"array"`, `"object"`,
  `"function"`, `"builtin"`). All value fields are `readonly`; arrays/objects are
  **mutable reference values** (`ArrayValue.elements: Value[]`,
  `ObjectValue.entries: Map<string, Value>` — a `Map`, for insertion order).
- **`FunctionValue`** carries `{ node: FunctionNode, closure: Environment, name: string | null }`.
- **`BuiltinValue`** carries `{ name, arity: Arity, impl: BuiltinImpl }`;
  `Arity = { min: number, max: number | null }` (`max: null` = variadic).
- **`Environment`** is the interface in §Environment of the contract: `parent`,
  `define(name, value)`, `get(name, span)`, `assign(name, value, span)`,
  `has(name)`, `child()`. `get`/`assign` throw `RuntimeErr(UndefinedVariable)` on miss.
- **`BuiltinContext`** = `{ write(text), call(callee, args, span) }`. The
  interpreter provides this to builtins; `call` re-enters the SAME evaluation
  machinery (preserves stack frames) so higher-order builtins work.
- **`Interpreter`** = `{ globals: Environment; run(program): Value }`.
  `InterpreterOptions` = `{ write?, builtins?: Iterable<BuiltinValue>, maxCallDepth? }`.
  **Builtins are injected via `options.builtins`** — the interpreter installs them
  into `globals`; it does **NOT** hardcode stdlib (that is the `stdlib` task).

## 4. Shared core (`../src/core`, owned by scaffold) — import, don't reimplement

Barrel `@core` (see `src/core/index.ts`) re-exports:
- Span helpers: `makePosition`, `makeSpan`, `pointSpan`, `mergeSpans`, `spanLength`.
- Error classes: `KleinErrorBase`, `LexicalError`, `SyntaxErr`, **`RuntimeErr`**.
- Diagnostic renderer: `DiagnosticFmt`, `diagnosticFormatter`, `formatDiagnostic`, `RenderOptions`.

Vocabulary types (`Span`, `ErrorCode`, `Diagnostic`, `StackFrame`, …) come from
`@contracts`, not `@core`.

**`RuntimeErr` (from `@core`)** — `new RuntimeErr(code, message, span, callStack?)`.
- `code: ErrorCode`; `span: Span` (always present); optional
  `callStack?: readonly StackFrame[]` (innermost frame **last**). The Klein call
  stack is `callStack`, NOT `stack` (native `Error.stack` owns `stack`);
  `toDiagnostic()` maps `callStack` → the diagnostic's `stack` field.
- Every runtime fault MUST be a `RuntimeErr` with the correct `ErrorCode` and a
  real `Span`. The evaluator attaches the maintained call stack when throwing.

**`ErrorCode` runtime members** (`../contracts/errors.ts`) — emit the right one:
`UndefinedVariable` (E3001), `TypeMismatch` (E3002), `NotCallable` (E3003),
`WrongArgumentCount` (E3004), `IndexOutOfRange` (E3005), `InvalidIndexTarget`
(E3006), `InvalidIndexType` (E3007), `PropertyNotFound` (E3008), `DivisionByZero`
(E3009), `InvalidOperand` (E3010), `AssertionFailed` (E3011), `StackOverflow`
(E3012), `UserError` (E3013). Tests assert on `ErrorCode`, **never** message text.

## 5. The AST consumed (`../contracts/ast.ts`) — READ-ONLY

`Program.body: readonly Statement[]`. Node kinds are literal-string discriminated
(`"NumberLiteral"`, `"BinaryExpression"`, `"LetStatement"`, …). Notable for the
evaluator: `AssignmentTarget = Identifier | IndexExpression | MemberExpression`;
`IfStatement.alternate: BlockStatement | IfStatement | null` (else-if chains);
`ForStatement` clauses all optional; `FunctionNode = FunctionLiteral |
FunctionDeclaration`; `MemberExpression.property: string` (+ `propertySpan`);
`ObjectEntry.key: string` (pre-resolved). Every node carries `span`.

## 6. Cross-cutting conventions (binding on all children — from root §7)

- **TypeScript strict; ESM `NodeNext`; Node ≥ 18.** Test runner **Vitest**;
  **ESLint** + **Prettier** must be clean. Use the versions/config `scaffold` pinned.
- **No `any`** in exported signatures. Discriminated unions handled with an
  **exhaustive `switch` + `never`-assertion default arm** (a `ValueKind` /
  AST-`kind` switch that omits a case must fail `tsc`).
- **Determinism:** object key order = insertion order (`Map`). Number formatting is
  fixed and documented — **integers print without a trailing `.0`**; the canonical
  value stringifier is owned by `runtime.values`. (Follow root §3/§7 + `docs/LANGUAGE.md`.)
- **Errors always carry a `Span`.** No error thrown without one.
- **Truthiness:** ONLY `null` and `false` are falsy (`0`, `""`, `[]`, `{}` are truthy).
- **Equality (`==`/`!=`):** structural for primitives (`null`, bool, number,
  string); arrays/objects/functions/builtins compare by **reference identity**.
- Each child exposes/contributes to the runtime subtree barrel `index.ts`
  (owned + assembled by `runtime.evaluator`).
- **Tests use the REAL lexer+parser** (`../src/lexer`, `../src/parser`) — never
  hand-mocked token/AST. Pattern (from `tests/parser/helpers.ts`):
  ```ts
  const { tokens } = new Lexer(src, name).tokenize();
  const { program } = new Parser(tokens, name).parse();
  ```

## 7. Methodology posture

The engine software-methodology bundle was **unavailable** here too
(`agent_domain_unset`), as at the root (root §8). Methodology is therefore encoded
in the contracts + root hub + this hub + each brief. Children SHOULD load the
bundle if it becomes available and reconcile; nothing here should contradict
standard tree-walker construction (recursive AST visitor, closures capturing the
defining `Environment`, control flow via internal signals rather than host
exceptions leaking to callers).

## 8. Success criteria (subtree-level)

- [ ] `src/runtime/values.ts`, `environment.ts`, `interpreter.ts`, `index.ts` exist and
      implement the `Value`/`Environment`/`Interpreter` contract with no `any` in public surface.
- [ ] `tsc` (strict) + ESLint + Prettier clean over `src/runtime/**` and `tests/runtime/**`.
- [ ] `tests/runtime/**` exercise every operator & value kind, closures
      (counter/adder), recursion, all control flow incl. `break`/`continue`/`return`,
      structural-vs-reference equality, and **every** runtime `ErrorCode` including
      stack-trace content; assertions key off `ErrorCode`; ≥90% coverage.
- [ ] Builtins injectable via `InterpreterOptions.builtins`; interpreter calls them
      through `BuiltinContext`; no stdlib hardcoded.
- [ ] `../contracts/` unmodified; ownership partition respected (no cross-writes).
