# COMPLETE — `SUBTASK_stdlib` (Klein standard library)

**Task**: Implement Klein's builtin functions and a registry that installs them
into the interpreter's global scope, using the contract's builtin calling
convention.
**Decompose evaluation**: `Atomic` (one cohesive single-responsibility module —
the native library — built against one calling convention with one shared helper
layer; every decomposition trigger cleared, both concern tests passed).
**Result**: COMPLETED. All success criteria met and verified mechanically.

---

## What was built

A complete, documented standard library under `src/stdlib/`, composed against the
read-only contract (`contracts/values.ts` → `BuiltinImpl` / `BuiltinContext` /
`Arity` / `BuiltinValue`) and the real, completed `src/runtime/**` + `src/core/**`.
`contracts/` was imported literally and never modified.

**39 builtins across 7 categories**, each a `BuiltinImpl` with a declared `Arity`,
each throwing a `RuntimeErr` (from `@core`) on a Klein-level fault (never leaking a
raw JS error). The interpreter enforces arity *before* invoking a builtin, so
`impl` bodies assume in-range `args`; the interpreter also attaches the live Klein
call stack when a builtin unwinds.

| Category | Builtins (arity) |
|---|---|
| **I/O** (`io.ts`) | `print`(0+), `println`(0+) — write via `ctx.write`, return `null` |
| **Inspection** (`inspection.ts`) | `len`(1), `type`(1), `keys`(1), `values`(1), `has`(2), `contains`(2) |
| **Conversions** (`conversions.ts`) | `str`(1), `num`(1), `int`(1), `bool`(1), `chars`(1), `ord`(1), `chr`(1) |
| **Collections** (`collections.ts`) | `push`(2+), `pop`(1), `slice`(2–3), `range`(1–3), `map`(2), `filter`(2), `reduce`(3), `sort`(1–2), `join`(1–2), `split`(1–2) |
| **Strings** (`strings.ts`) | `upper`(1), `lower`(1), `trim`(1) |
| **Math** (`math.ts`) | `abs`(1), `floor`(1), `ceil`(1), `round`(1), `sqrt`(1), `min`(1+), `max`(1+), `pow`(2) |
| **Diagnostics** (`diagnostics.ts`) | `assert`(1–2), `error`(1), `clock`(0) |

**Registry**: `defaultBuiltins()` (`registry.ts`) aggregates the whole roster into
a fresh array (sharing the immutable `BuiltinValue` instances). This is the single
entry point the `cli` facade installs via
`new Interpreter({ builtins: defaultBuiltins() })`. The public barrel
`src/stdlib/index.ts` exports `defaultBuiltins` plus the per-category arrays.

**Shared helper layer** (`helpers.ts`): the `builtin(name, min, max, impl)` factory
and the `expect*` argument-type assertions. Error-code discipline (per brief):
- **Wrong argument *kind*** → `TypeMismatch` (E3002) — e.g. `abs("x")`, `len(1)`.
- **Right kind, out-of-domain *value*** → `InvalidOperand` (E3010) — e.g.
  `chr(-1)`, `num("abc")`, `pop([])`, `range(0,10,0)`, `sort([1,"a"])`.
- **Callee/arity faults in higher-order builtins** are raised by the interpreter
  itself via `ctx.call` (`NotCallable` E3003, `WrongArgumentCount` E3004).
- `assert` → `AssertionFailed` (E3011); `error` → `UserError` (E3013).

## Key semantic decisions (documented for the doc follow-up below)

- **Mutation vs. copy** (consistent with `docs/LANGUAGE.md` §3 reference values):
  `push`/`pop` mutate the array in place; `slice`/`map`/`filter`/`sort` return a
  **fresh** array (so `sort` is non-destructive, unlike JS `Array#sort`).
- **Higher-order builtins** (`map`, `filter`, `reduce`, `sort`-with-comparator)
  invoke callbacks through `ctx.call` — the interpreter's own machinery — so real
  user closures run with correct lexical scope, stack frames, arity checking, and
  not-callable detection, with no re-implementation of calling in the stdlib.
- **Unicode by code point**: `len(string)`, `chars`, `ord`, `chr`, and string
  `slice` all operate on Unicode code points (`[...s]`), so they agree (astral
  characters count as one).
- **`slice`** uses JS-`slice` window semantics: negative indices count from the
  end; bounds clamp to `[0, len]`.
- **`sort`** without a comparator requires a homogeneous all-number or all-string
  array (natural order; numeric, not lexical, for numbers); otherwise
  `InvalidOperand`. A comparator must return a number (`TypeMismatch` otherwise).
- **`num`/`int`** accept number, boolean (`1`/`0`), and strictly-parsed numeric
  strings; `int` truncates toward zero and rejects non-finite (`InvalidOperand`).
- **`clock`** returns fractional seconds since the Unix epoch (non-deterministic).

## Verification (all green)

- `npm run typecheck` (`tsc --noEmit`, strict) — **0 errors**. No `any` in public
  surface.
- `npm run lint` (`eslint .`) — **0 problems**.
- `npm run format:check` (`prettier --check .`) — **clean**.
- `npx vitest run --coverage` — **437/437 tests pass** across all 20 suites
  (85 new stdlib tests + every sibling stage still green).
- **Coverage — stdlib: 100% lines, 100% functions, 98.72% branches**
  (overall project 98.66% lines) — exceeds the ≥90% bar. Tests key off structured
  `ErrorCode`s and the canonical stringifier, never message text. Every builtin has
  happy-path + arity-error + type-error tests; higher-order builtins are driven
  through the real lexer→parser→interpreter pipeline with genuine user closures
  (`tests/stdlib/harness.ts`).

## Owned outputs

- `src/stdlib/`: `helpers.ts`, `io.ts`, `inspection.ts`, `conversions.ts`,
  `collections.ts`, `strings.ts`, `math.ts`, `diagnostics.ts`, `registry.ts`,
  `index.ts` (barrel).
- `tests/stdlib/`: `harness.ts` + one `*.test.ts` per category + `registry.test.ts`.

No file outside the declared ownership subtree (`src/stdlib/**`, `tests/stdlib/**`)
was written; `contracts/` is unmodified.

## Handoff to `cli` (dependent)

`import { defaultBuiltins } from "../stdlib";` then
`new Interpreter({ builtins: defaultBuiltins(), write })`. The facade's
`InterpretFacadeOptions.builtins` (default = full stdlib) maps directly onto
`InterpreterOptions.builtins`. `print`/`println` honor the interpreter's `write`
sink, so REPL/file-runner output redirection works out of the box.

## Doc follow-up (coordination note — NOT actioned here)

`docs/LANGUAGE.md` is **scaffold-owned and read-only to this task**. Its
§"The standard library" **intentionally does not enumerate the roster** ("The
concrete roster of builtins is defined by the standard library and documented
separately; this specification fixes only how builtins behave as values, not which
builtins exist."). Therefore the **entire 39-builtin roster above is a documentation
addition** for a future scaffold/doc pass (or the `integration` synthesis task) to
fold into `docs/LANGUAGE.md`. The table + "Key semantic decisions" section here are
authored to be lifted directly. No contract or existing spec statement is
contradicted; this is additive documentation only.
