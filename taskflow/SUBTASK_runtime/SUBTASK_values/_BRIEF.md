# Task: Value system — constructors, equality, truthiness, stringifier

**Slug**: `values` (task id `runtime.values`) · **Depends on**: `scaffold`, `parser`
· **Dependents**: `runtime.evaluator`

## Objective
Implement the concrete Klein **value system** realizing the `Value` union of
`../../contracts/values.ts`: constructors for every `ValueKind`, structural
equality (`==`/`!=` semantics), truthiness, and the canonical value stringifier.

## Context
Part of the Klein `runtime` subtree. Read `../_GLOBAL.md` (subtree hub) and the
project root `../../_GLOBAL.md` first. You realize the value shapes in
`../../contracts/values.ts` and consume `ErrorCode`/`Span`/`RuntimeErr` vocabulary
from `@contracts` / `@core`. This is a **precursor**: `runtime.environment` runs in
parallel with you; `runtime.evaluator` consumes your module. Do **not** implement
the `Environment` class or the evaluator — those are sibling tasks.

## Scope (one cohesive concern: the value model)
- **Constructors / helpers** for every `Value` variant (`null`, boolean, number,
  string, array, object, function, builtin) — small, total factory functions that
  produce contract-shaped `readonly` values. Prefer sharing singleton `null`/`true`/
  `false` where it does not break the reference-identity equality rule.
- **Truthiness** — a predicate where **only** `null` and `false` are falsy;
  everything else (incl. `0`, `""`, empty array/object) is truthy (root §3).
- **Structural equality** for `==`/`!=` — structural for primitives (`null`,
  boolean, number, string; note number equality is IEEE-754, so `NaN != NaN`);
  arrays, objects, functions, and builtins compare by **reference identity**
  (root §3, `../_GLOBAL.md` §6). Cross-kind comparisons are `false` (not an error).
- **Canonical stringifier** — the single source of truth for rendering a `Value` as
  text (used later by `print`/REPL/error messages). Number formatting is fixed and
  documented: **integers print with no trailing `.0`**; render arrays as
  `[a, b, …]` and objects as `{ key: value, … }` in insertion order; strings render
  as their raw contents in value position (decide + document quoting for nested
  contexts consistently with `docs/LANGUAGE.md`). A `switch` over `ValueKind` MUST
  be exhaustive with a `never` default arm.

The atomic-vs-decompose decision is yours to make at dispatch; this is one module
of one responsibility and is expected to be **Atomic**, but evaluate honestly.

## Inputs (read at execution start)
| Input | Source | Purpose |
|---|---|---|
| Subtree hub | `../_GLOBAL.md` | Contract facts, conventions, ownership |
| Root hub | `../../_GLOBAL.md` | Language semantics (§3), conventions (§7) |
| Value contract | `../../contracts/values.ts` | The `Value` union to realize (read-only) |
| Errors contract | `../../contracts/errors.ts` | `ErrorCode` (if any stringify path can fault) |
| Core barrel | `../../src/core` (`@core`) | `RuntimeErr`, span helpers |
| Language spec | `../../docs/LANGUAGE.md` | Authoritative truthiness/equality/number-format rules |

## Owned outputs (write ONLY these)
- `src/runtime/values.ts` — the value system module.
- `tests/runtime/values.test.ts` — its unit tests.

## Success criteria
- Realizes the `Value` union and its variants exactly (no `any` in public surface;
  exhaustive `switch` + `never` default on `ValueKind`).
- Tests cover every `ValueKind`, truthiness (incl. `0`/`""`/`[]`/`{}` truthy),
  structural-vs-reference equality (equal primitives; distinct-but-equal arrays are
  `!=` by reference), and stringifier output incl. integer-vs-float formatting and
  nested array/object rendering. ≥90% coverage of this module.
- `tsc` (strict) + ESLint + Prettier clean.

## Constraints
- Import the contract literally; **never edit `../../contracts/`**.
- Reference-identity rule for arrays/objects/functions/builtins is non-negotiable.
- Do not depend on `Environment` internals or the evaluator; keep this module a
  leaf the evaluator composes. If you need something only the interpreter can
  provide, surface it in `COMPLETE.md` rather than reaching across the boundary.
