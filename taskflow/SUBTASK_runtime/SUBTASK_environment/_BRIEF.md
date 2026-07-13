# Task: Environment — lexical scope chain

**Slug**: `environment` (task id `runtime.environment`) · **Depends on**: `scaffold`,
`parser` · **Dependents**: `runtime.evaluator`

## Objective
Implement the concrete `Environment` (lexical scope chain) realizing the
`Environment` interface of `../../contracts/values.ts`, with correct shadowing and
`UndefinedVariable` diagnostics on miss.

## Context
Part of the Klein `runtime` subtree. Read `../_GLOBAL.md` (subtree hub) and the
project root `../../_GLOBAL.md` first. This is a **precursor** running in parallel
with `runtime.values`; `runtime.evaluator` consumes your class to build call
scopes and closures. Do **not** implement value constructors or the evaluator.

## Scope (one cohesive concern: the scope chain)
Realize the contract `Environment` interface exactly:
- `readonly parent: Environment | null` — `null` for the global scope.
- `define(name, value)` — bind in **this** scope, shadowing any outer binding
  (re-`define` of the same name in the same scope overwrites).
- `get(name, span): Value` — search this scope then outward; on miss throw
  `new RuntimeErr(ErrorCode.UndefinedVariable, <message>, span)` (span-anchored).
- `assign(name, value, span)` — assign to the **nearest existing** binding
  searching outward; on miss (name bound nowhere) throw
  `RuntimeErr(UndefinedVariable, …, span)`. Does NOT create a new binding.
- `has(name): boolean` — true iff bound anywhere in the chain.
- `child(): Environment` — a new nested scope whose `parent` is this environment.

Use a `Map<string, Value>` per scope for the bindings. Keep it a small, total,
well-typed class. The evaluator (sibling) owns call-depth/stack-overflow concerns —
**not** this module; `Environment` only models lexical binding + lookup.

Evaluate atomicity honestly at dispatch; this is expected **Atomic** (one small,
cohesive module).

## Inputs (read at execution start)
| Input | Source | Purpose |
|---|---|---|
| Subtree hub | `../_GLOBAL.md` | Contract facts, conventions, ownership |
| Root hub | `../../_GLOBAL.md` | Scoping semantics (§3), conventions (§7) |
| Value contract | `../../contracts/values.ts` | `Environment` + `Value` shapes (read-only) |
| Errors contract | `../../contracts/errors.ts` | `ErrorCode.UndefinedVariable` |
| Core barrel | `../../src/core` (`@core`) | `RuntimeErr`, span helpers |

## Owned outputs (write ONLY these)
- `src/runtime/environment.ts` — the `Environment` implementation.
- `tests/runtime/environment.test.ts` — its unit tests.

## Success criteria
- Implements the `Environment` interface exactly (no `any` in public surface).
- Tests cover: define/get across nested scopes, inner-shadows-outer, `assign`
  targeting an outer binding (mutation visible to inner `get`), `assign`-to-unbound
  → `UndefinedVariable`, `get`-of-unbound → `UndefinedVariable` (assert on
  `ErrorCode` **and** that the thrown value is a `RuntimeErr` carrying the given
  `span`), `has` across the chain, and `child()` parent linkage. ≥90% coverage.
- `tsc` (strict) + ESLint + Prettier clean.

## Constraints
- Import the contract literally; **never edit `../../contracts/`**.
- Every thrown error is a `RuntimeErr` with the caller-supplied `Span` and the
  correct `ErrorCode`; never throw a bare JS error.
- No dependency on `values.ts` internals beyond the `Value` type, and none on the
  evaluator. Keep this a leaf the evaluator composes.
