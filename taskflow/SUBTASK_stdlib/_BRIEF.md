# Task: Standard library (builtins + registry)

**Slug**: `stdlib` · **Depends on**: `runtime` · **Dependents**: `cli`

## Objective
Implement Klein's builtin functions and a registry that installs them into the
interpreter's global scope, using the contract's builtin calling convention.

## Context
Part of **Klein** (see `../_GLOBAL.md`). Each builtin is a `BuiltinImpl`
(`../contracts/values.ts`) wrapped in a `BuiltinValue` with a declared `Arity`.
The interpreter (real, from `../src/runtime/`) enforces arity before calling and
supplies a `BuiltinContext` (`write`, re-entrant `call`). Higher-order builtins
(e.g. `map`, `filter`, `reduce`) MUST invoke user callables via `ctx.call`.

## Inputs (read at start)
- `../_GLOBAL.md`, `../contracts/values.ts`, `../contracts/errors.ts`
- `../src/runtime/**` and `../src/core/**` (real, completed).

## Approach (single responsibility: native library)
Provide a coherent, documented set covering: I/O (`print`, `println`), inspection
(`len`, `type`, `keys`, `values`, `has`, `contains`), conversions (`str`, `num`,
`int`, `bool`, `chars`, `ord`, `chr`), collections (`push`, `pop`, `slice`,
`range`, `map`, `filter`, `reduce`, `sort`, `join`, `split`), strings (`upper`,
`lower`, `trim`), math (`abs`, `floor`, `ceil`, `round`, `sqrt`, `min`, `max`,
`pow`), and diagnostics (`assert`, `error`, `clock`). Each builtin: correct arity,
correct `ErrorCode` on bad argument types (`TypeMismatch`/`InvalidOperand`),
mutation semantics consistent with §3 (arrays/objects are reference values).
Export a single `defaultBuiltins()` / registry the `cli` facade installs.

Finalize the exact roster in `docs/LANGUAGE.md`'s stdlib section (coordinate: that
doc is scaffold-owned and read-only to you — reference it; if it lacks a function
you add, note the addition in your completion record for a doc follow-up).

## Owned outputs
`src/stdlib/**` (builtins + registry + `index.ts`), `tests/stdlib/**`.

## Success criteria
- Every builtin implements `BuiltinImpl`; arities declared; `tsc`/lint/format clean.
- Tests: happy path + arity errors + type errors (by `ErrorCode`) for each builtin;
  higher-order builtins tested with real user closures via the interpreter. ≥90% coverage.

## Constraints
- Import contract + `src/core` + `src/runtime`; never edit `contracts/`. No `any` in public surface.
- Builtins throw `RuntimeErr` for Klein-level faults; never leak raw JS errors.
