# Task: Evaluator — tree-walking Interpreter (synthesis hub of the runtime subtree)

**Slug**: `evaluator` (task id `runtime.evaluator`) · **Depends on**:
`runtime.values`, `runtime.environment`, `parser` · **Dependents**: (via `runtime`)
`stdlib`

## Objective
Implement the tree-walking `Interpreter` (`../../contracts/values.ts#Interpreter`):
a recursive evaluator over statements/expressions that composes the completed
value system (`runtime.values`) and environment (`runtime.environment`) into a
working interpreter with correct semantics, closures, control flow, and
source-anchored runtime diagnostics — and assemble the runtime subtree barrel.

## Context
Part of the Klein `runtime` subtree and its **synthesis hub**. Read `../_GLOBAL.md`
(subtree hub) and root `../../_GLOBAL.md` first. Your dependencies are COMPLETE:
**import their real modules** — `../values` and `../environment` (via the paths
they were authored at: `src/runtime/values.ts`, `src/runtime/environment.ts`) — do
not reimplement value constructors, equality, truthiness, the stringifier, or the
scope chain. Use the **real** lexer+parser (`../../src/lexer`, `../../src/parser`)
in tests, never hand-mocked ASTs.

## This task spans distinct evaluator concerns — evaluate atomicity honestly
Name them so your own Scope/Distinct-Concerns/Single-Responsibility evaluation is
honest; **sub-decompose if the triggers fire** (the evaluator is large — Output
Size may fire). Candidate concerns:
1. **Expression evaluation** — literals, identifiers, array/object literals,
   unary `-`/`!`, binary arithmetic (`+ - * / %`) with numeric semantics **and**
   string concatenation for `+`, comparisons (`< > <= >=` numeric/string; `== !=`
   via the value system's structural equality), short-circuit logical `&& ||`,
   indexing get `a[i]`, member get `o.k`, and call `f(x)`.
2. **Statements & control flow** — `let`, expression statements, blocks (new child
   scope), `if/else if/else`, `while`, C-style `for(init; cond; upd)`,
   `return`/`break`/`continue` realized as **internal control-flow signals**
   contained within the evaluator (never thrown JS values observable to callers),
   `FunctionDeclaration` (value-bound in the current scope), and assignment to each
   `AssignmentTarget` (identifier via `Environment.assign`; `a[i]=` and `o.k=`
   mutating array/object in place).
3. **Function/builtin application & call machinery** — build `FunctionValue`
   closures over the defining `Environment`; apply with a **fresh call scope** that
   is a child of the closure (not the call site); bind params (arity → 
   `WrongArgumentCount`); a **call-depth guard** raising `StackOverflow`; a
   maintained **Klein call stack** attached to every thrown `RuntimeErr`
   (`callStack`, innermost last); and the `BuiltinContext` (`write` + re-entrant
   `call`) so injected builtins run through the same machinery.

If you decompose, the natural shape is expression-eval + statement/control-flow +
call-machinery as precursors feeding a small synthesis that wires the
`Interpreter` class and barrel. If you keep it Atomic (one cohesive mutually-
recursive visitor is a defensible single responsibility), record that reasoning.

## Error codes (emit the correct one, always a `RuntimeErr` with a real `Span`)
`TypeMismatch`, `NotCallable`, `WrongArgumentCount`, `IndexOutOfRange`,
`InvalidIndexTarget`, `InvalidIndexType`, `PropertyNotFound`, `DivisionByZero`,
`InvalidOperand`, `StackOverflow` (and `UndefinedVariable` surfaces from
`Environment`). Attach the maintained call stack when throwing.

## Interpreter surface & builtin injection (from the contract)
- Construct from `InterpreterOptions` (`write?`, `builtins?: Iterable<BuiltinValue>`,
  `maxCallDepth?`). Install `options.builtins` into `globals` — **do NOT hardcode
  stdlib** (that is the `stdlib` task); default `builtins` to empty/none here.
- Expose `globals: Environment` and `run(program): Value` (value of the final
  expression statement, else `null`; throws `RuntimeErr` on first runtime fault —
  the CLI facade catches it, per root §4).
- Provide `BuiltinContext.call` that dispatches to function/builtin uniformly and
  preserves stack frames.

## Owned outputs (write ONLY these; if you sub-decompose, children partition them)
- `src/runtime/interpreter.ts` — the `Interpreter` implementation.
- `src/runtime/index.ts` — the **runtime subtree barrel**: re-export the public
  runtime surface (value constructors/helpers from `values`, the `Environment`
  implementation, and the `Interpreter`) so `stdlib`/`cli` import from one place.
- `tests/runtime/interpreter.test.ts` — evaluator tests (real lexer+parser).

## Success criteria
- Implements `Interpreter` from the contract; composes the real `values` +
  `environment` modules; `tsc`/lint/format clean; no `any` in public surface;
  exhaustive AST-`kind` switches with `never` default arms.
- Tests exercise every operator & value kind, closures (counter/adder), recursion
  (e.g. fibonacci/factorial), all control flow incl. nested `break`/`continue` and
  early `return`, string `+` vs numeric `+`, structural vs reference equality
  through the evaluator, and **every** runtime `ErrorCode` above **including
  stack-trace content** (assert frames on a thrown `RuntimeErr.callStack`). Assert
  on `ErrorCode`, never message text. ≥90% coverage.
- Builtins injected via `InterpreterOptions.builtins` are callable and run through
  `BuiltinContext`; a test proves an injected builtin (and a higher-order one using
  `ctx.call`) works without any stdlib present.

## Constraints
- Import the contract + `../../src/core` + real `values`/`environment`/`lexer`/
  `parser`; **never edit `../../contracts/`**; write only your owned outputs.
- `break`/`continue`/`return` MUST be internal signals contained within the
  evaluator — never observable to callers as thrown JS values.
- Fresh call scope is a child of the **closure**, not the call site (lexical
  scoping). Guard recursion depth → `StackOverflow` before the host stack blows.
