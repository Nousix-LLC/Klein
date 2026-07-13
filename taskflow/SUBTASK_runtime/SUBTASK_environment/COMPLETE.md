# COMPLETE — `runtime.environment` (lexical scope chain)

**Task**: `runtime.environment` · **Decompose evaluation**: Atomic · **Status**: completed
**Date**: 2026-07-13

## Objective (met)
Implemented the concrete `Environment` (lexical scope chain) realizing the
`Environment` interface of `../../contracts/values.ts`, with correct shadowing and
span-anchored `UndefinedVariable` diagnostics on miss. One cohesive concern; no
value constructors, no evaluator — as scoped.

## Owned outputs (only these written; ownership partition respected)
- `src/runtime/environment.ts` — the `Environment` implementation.
- `tests/runtime/environment.test.ts` — its unit tests.

`../../contracts/` unmodified; no sibling files touched (`runtime.values` and
`runtime.evaluator` outputs untouched).

## What was built
A small, total, well-typed `class Environment implements EnvironmentContract`:
- `readonly parent: Environment | null` — `null` at the global scope.
- Bindings held in a `private readonly bindings: Map<string, Value>` per scope
  (Map, not a plain object → no `Object.prototype` collision / prototype
  pollution; consistent with the value model's Map-for-objects rationale).
- `define(name, value)` — writes into **this** scope; re-define overwrites;
  transparently shadows any outer binding.
- `get(name, span)` — resolves this scope then outward (recursively); returns the
  innermost binding. Uses `Value`-is-never-`undefined` as the presence test.
- `assign(name, value, span)` — mutates the **nearest existing** binding in place
  (visible to inner scopes); never implicitly declares.
- `has(name)` — true iff bound anywhere in the chain.
- `child()` — a fresh nested scope linked to this one.

Both `get` and `assign` throw `new RuntimeErr(ErrorCode.UndefinedVariable, …,
span)` on a total miss, threading the caller-supplied `Span` through unchanged so
the fault stays anchored to the use site. No bare JS `Error` is ever thrown.

### Design notes / decisions
- **Recursive chain walk (not a `this`-aliasing loop).** The outward search is
  expressed as recursion over `parent` — idiomatic for a scope chain and required
  to satisfy `@typescript-eslint/no-this-alias`. Depth = lexical nesting depth
  (modest); call-depth/stack-overflow concerns belong to the evaluator, not here.
- **Contract realized exactly**, imported literally from `@contracts`
  (interface aliased as `EnvironmentContract` to free the class name); `RuntimeErr`
  imported from `@core`. No `any` in the public surface.
- **Tests are lexer/parser-free by design.** `Environment` is a pure structure
  over names/`Value`s/`Span`s with no token/AST input, so tests build minimal
  contract-shaped `Value` literals (keeping the suite independent of the parallel
  `runtime.values` task) and real `@core` span helpers. The "use the real
  lexer+parser" convention targets AST-shaped inputs, which this module has none of.

## Verification (all green, run under Node v24.18.0)
- `npm run typecheck` (`tsc -p tsconfig.json`, strict) — **0 errors**.
- `eslint src/runtime/environment.ts tests/runtime/environment.test.ts` — **clean**.
- `prettier --check` on both files — **clean**.
- `vitest run tests/runtime/environment.test.ts --coverage` — **19/19 passed**,
  coverage on `src/runtime/environment.ts`: **100%** statements / **100%** branches
  / **100%** functions / **100%** lines (≥90% bar exceeded).

### Success-criteria coverage map
- define/get across nested scopes ✓ · inner-shadows-outer ✓ · outer binding left
  intact by shadow ✓
- `assign` targeting an outer binding, mutation visible to inner `get` ✓ ·
  `assign` to nearest (shadowed) binding, not outer ✓
- `assign`-to-unbound → `UndefinedVariable`, and creates no binding ✓
- `get`-of-unbound → `UndefinedVariable`, asserting on `ErrorCode` **and** that the
  thrown value is a `RuntimeErr` (and `Error`) carrying the exact given `span`
  (by reference) ✓
- `has` across the chain (local / outer true, absent false) ✓
- `child()` parent linkage, global `parent === null`, independent siblings ✓
- null stored and resolved as a value (not treated as absence) ✓

## Handoff to `runtime.evaluator` (synthesis hub)
- Import the class: `import { Environment } from "../runtime/environment"` (or via
  the subtree barrel `src/runtime/index.ts`, which the evaluator owns/assembles).
- Build the global scope with `new Environment()`; derive block/function/closure
  scopes with `.child()`; a closure captures its defining `Environment` (store it
  as `FunctionValue.closure`).
- Variable read → `env.get(name, span)`; assignment to an existing binding →
  `env.assign(name, value, span)`; `let` / parameter binding → `env.define(...)`.
  `get`/`assign` already emit contract-correct `UndefinedVariable` faults; the
  evaluator attaches the maintained call stack at higher throw sites as needed.
- This module deliberately does **not** touch call depth / `StackOverflow`; that
  remains the evaluator's responsibility.
