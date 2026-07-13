# Task: Runtime (AST → Value): values, environment, evaluator

**Slug**: `runtime` · **Depends on**: `scaffold`, `parser` · **Dependents**: `stdlib`

## Objective
Implement the tree-walking evaluator and its supporting value system and lexical
environment, so a parsed `Program` runs to a `Value` with correct semantics,
closures, and source-anchored runtime diagnostics.

## Context
Part of **Klein** (see `../_GLOBAL.md` §3–§4, §7). You realize
`../contracts/values.ts` (`Value`, `Environment`, `Interpreter`) and consume
`../contracts/ast.ts`. Use the **real** lexer+parser in tests. Import `RuntimeErr`
+ Span helpers from `../src/core`.

## This task spans three cohesive-but-distinct concerns (evaluate atomicity honestly)
1. **Value system** — concrete constructors for every `ValueKind`, structural
   equality (`==` semantics per §3), truthiness (only `null`/`false` falsy), and a
   canonical value stringifier (number formatting per §7; array/object rendering).
2. **Environment** — the `Environment` scope chain (`define`/`get`/`assign`/`has`/`child`)
   with correct shadowing and `UndefinedVariable` on miss.
3. **Evaluator** — recursive tree-walk over statements/expressions: arithmetic &
   string `+`, comparisons, short-circuit logic, indexing/member get+set,
   assignment, `if/while/for`, `break`/`continue`/`return` (via internal
   control-flow signals, not host exceptions leaking out), function values &
   application with a fresh call scope over the closure, a call-depth guard
   (`StackOverflow`), and a maintained call stack attached to `RuntimeErr`.

Emit the correct `ErrorCode` for each fault: `TypeMismatch`, `NotCallable`,
`WrongArgumentCount`, `IndexOutOfRange`, `InvalidIndexTarget`/`InvalidIndexType`,
`PropertyNotFound`, `DivisionByZero`, `InvalidOperand`. Name these concerns so
your own Scope/Distinct-Concerns trigger evaluation is honest — sub-decompose if warranted.

## Owned outputs
`src/runtime/**` (`values.ts`, `environment.ts`, `interpreter.ts`, `index.ts`),
`tests/runtime/**`.

## Success criteria
- Implements `Value`/`Environment`/`Interpreter` from the contract; `tsc`/lint/format clean.
- Tests exercise every operator & value kind, closures (counter/adder), recursion,
  control flow incl. `break`/`continue`, structural vs reference equality, and every
  runtime `ErrorCode` including stack-trace content. Assert on `ErrorCode`. ≥90% coverage.
- Builtins are injectable via `InterpreterOptions.builtins`; the interpreter does
  NOT hardcode stdlib (that is the `stdlib` task) — but it MUST accept and call them
  through `BuiltinContext`.

## Constraints
- Import contract + `src/core` + `src/lexer`/`src/parser` (tests); never edit `contracts/`.
- No `any` in public surface; exhaustive `switch` with `never` default on unions.
- `break`/`continue`/`return` MUST be implemented as internal signals contained
  within the evaluator, never observable to callers as thrown JS values.
