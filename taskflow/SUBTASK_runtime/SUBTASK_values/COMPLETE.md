# COMPLETE — `runtime.values` (Klein value system)

**Task**: `runtime.values` · **Decompose evaluation**: `Atomic` · **Status**: completed
**Date**: 2026-07-13

Implemented the concrete Klein **value system** realizing the `Value` union of
`contracts/values.ts`: constructors for every `ValueKind`, truthiness, structural
`==` equality, and the canonical value stringifier. One cohesive concern, one
owned module + its unit tests.

## Owned outputs (only these were written)

| Path | What |
|---|---|
| `src/runtime/values.ts` | The value-system module (constructors, `isTruthy`, `valuesEqual`, `stringify`). |
| `tests/runtime/values.test.ts` | 40 unit tests over the four concerns. |

`contracts/` was **not** modified. No sibling file was touched (ownership
partition in `../_GLOBAL.md` §2 respected).

## Verification (all green)

- `npm run typecheck` (tsc strict, `bundler` resolution) — clean.
- `npx eslint` over both files — clean (no `any`; exhaustive `switch` + `never`).
- `npx prettier --check` over both files — clean.
- `npx vitest run tests/runtime/values.test.ts` — **40 passed**.
- Coverage of `src/runtime/values.ts`: **100%** statements / lines / functions,
  **98.38%** branches (≥90% bar met). The one uncovered branch is the defensive
  `?? 0` fallback on `codePointAt(0)`, which a non-empty `for…of` char can't hit.
- Full repo suite (`npm test`) — **289 passed** (my 40 compose with every existing
  lexer/parser/core suite and the sibling `runtime/environment` suite).

## Public surface (what the evaluator/stdlib compose against)

Constructors (compound values are always fresh objects → reference identity holds):
`NULL`, `TRUE`, `FALSE` (shared singletons), `makeNull`, `makeBoolean`,
`makeNumber`, `makeString`, `makeArray(elements?)`, `makeObject(entries?)`,
`makeFunction(node, closure, name)`, `makeBuiltin(name, arity, impl)`.
Operations: `isTruthy(value)`, `valuesEqual(a, b)`, `stringify(value)`.

- `makeArray` stores the given backing array **by reference** (mutable reference
  value); `makeObject` seeds a fresh insertion-ordered `Map` per call.
- `makeBoolean`/`makeNull` return shared singletons (safe: primitives compare by
  value, never by reference).

## Semantics decisions (fixed + documented here and in the module header)

1. **Truthiness** — only `null` and `false` are falsy; `0`, `""`, `[]`, `{}`,
   functions, builtins are all truthy (root §3, `docs/LANGUAGE.md#truthiness`).
2. **Equality** — primitives by value (numbers IEEE-754, so `NaN != NaN`,
   `+0 == -0`); arrays/objects/functions/builtins by reference identity;
   different kinds always `false` (never an error). `!=` is the evaluator's job
   (logical negation of `valuesEqual`).
3. **Number formatting** — `String(n)`: shortest round-tripping form, integers
   without a trailing `.0`; `NaN`/`Infinity`/`-Infinity` for non-finite doubles.
   (`docs/LANGUAGE.md` leaves the exact rendering to this stringifier; fixed here.)
4. **String rendering / nested quoting** (spec left this open — decided here):
   - **Top-level (value position)** → raw contents, so `print("hi")` shows `hi`.
   - **Nested** (inside array/object) → double-quoted literal with escapes
     (`\\ \" \n \t \r \0`, other C0 controls as `\uXXXX`), so `[1, "1"]` is
     unambiguous vs `[1, 1]`. The quoted form re-lexes back to the original.
   - **Object keys** render **bare** (unquoted raw string) → the documented
     `{ key: value }` shape. Values render nested (quoted).
5. **Function/builtin rendering** (spec/contract silent) → readable tags
   `<fn name>` / `<fn>` (anonymous) / `<builtin name>`. These are reference values
   with no textual literal form; the tag is a display convenience.

## Boundary notes for `runtime.evaluator` (the synthesis hub)

- This module is a **leaf**: it imports `@contracts` + `ValueKind` literally and
  nothing from `Environment`'s concrete impl or the evaluator. `FunctionValue`'s
  `node`/`closure` are stored opaquely and never inspected here.
- `stringify` is the **single source of truth** for value text. `print`/`println`
  (stdlib) and REPL/diagnostics should call it rather than re-deriving formatting.
- Deliberately **out of scope** (evaluator's concern, not surfaced here to keep
  the module minimal): a `Value → ErrorCode`-message helper (e.g. a `typeName(v)`
  for `TypeMismatch` text), `isCallable`, arithmetic/`+`-concat coercion, and the
  ordered comparisons `< > <= >=`. If the evaluator wants a kind→display-name
  helper it is a natural future addition to this module; it was not added on
  speculation (YAGNI). None of these require reaching across the value-model
  boundary — flagging per the brief rather than pre-building.
- Test double note: value-model tests build `Value`s directly; the one place a
  `FunctionValue` is needed uses the **real** lexer+parser for the AST `node`
  (per `../_GLOBAL.md` §6) and a small structural `Environment` **stub** for the
  closure (the real `Environment` is a sibling task this module must not import).
