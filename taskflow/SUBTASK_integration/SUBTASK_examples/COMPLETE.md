# COMPLETE — `SUBTASK_examples`

**Task**: Author a curated set of idiomatic Klein programs that exercise the
language end-to-end, plus a **generated** golden output for each — establishing
the shared example/golden contract the E2E suite consumes.

**Decompose evaluation**: `Atomic`. One responsibility, one kind of output
(`examples/**`). Every decomposition trigger cleared (token, scope, output-size)
and both concern tests passed — generating a golden by running the interpreter
is intrinsic to authoring correct golden *data*, not a distinct "verify"
responsibility (that is the sibling `SUBTASK_verification`).

## What was delivered (owned output: `examples/**`)

A curated set of **10** programs — 6 clean (`ok`) and 4 intentional-fault
(`error`) — each with a generated golden, plus the machine-readable manifest and
a human index.

| `<name>` | kind | demonstrates / fault | golden codes |
|---|---|---|---|
| `fibonacci` | ok | recursion + iteration, `for`, first-class fns | — |
| `fizzbuzz` | ok | `for`, `%`, `if`/`else if`/`else` | — |
| `closures` | ok | `fn` expressions, lexical capture, partial application | — |
| `higher_order` | ok | `range`/`map`/`filter`/`reduce`/`sort`/`join` | — |
| `data_structures` | ok | insertion-ordered objects, `keys`/`values`/`has`, reference arrays, `push`/`pop`, nesting | — |
| `strings` | ok | `trim`/`upper`/`lower`, `split`/`join`, `chars`, `ord`/`chr`, `contains`, `slice` | — |
| `errors_undefined` | error | assign to name never `let`-declared | `E3001` |
| `errors_type` | error | `1 + "two"` — `+` needs 2 numbers or 2 strings | `E3002` |
| `errors_divzero` | error | division by zero (diagnostic carries a call stack) | `E3009` |
| `errors_syntax` | error | two syntax faults; parser recovers, reports **both** | `E2003`, `E2003` |

Files (per the shared contract in `../_GLOBAL.md §3`):

- `examples/<name>.kl` — 10 programs.
- `examples/<name>.out` — 10 golden stdouts (color disabled; `errors_undefined`
  and `errors_syntax` are empty, `errors_type`/`errors_divzero` non-empty because
  they print before faulting — all intended).
- `examples/<name>.diag` — 4 golden rendered diagnostics (error examples only),
  `NO_COLOR`, snippet + `^` caret + `--> examples/<name>.kl:line:col` locator,
  plus runtime call stacks for the runtime faults.
- `examples/index.json` — the manifest: `{ name, kind, expectedCodes? }` per
  example, in curated order.
- `examples/README.md` — human index of the set.

## Builtin surface confirmed before authoring

Read `src/stdlib/registry.ts` and every category module. Programs use **only**
registered builtins: `print`/`println` (io); `len`/`type`/`keys`/`values`/`has`/
`contains` (inspection); `str`/`num`/`int`/`bool`/`chars`/`ord`/`chr`
(conversions); `push`/`pop`/`slice`/`range`/`map`/`filter`/`reduce`/`sort`/`join`/
`split` (collections); `upper`/`lower`/`trim` (strings); `abs`/`floor`/`ceil`/
`round`/`sqrt`/`min`/`max`/`pow` (math); `assert`/`error`/`clock` (diagnostics).
`map`/`filter`/`reduce` are real builtins, so `higher_order.kl` uses them
directly rather than defining them in-language. Error codes cited in
`index.json` were checked against `contracts/errors.ts`.

## How the goldens were generated (NOT hand-authored)

A throwaway generator (`SUBTASK_examples/gen-goldens.mjs`, in this workspace —
**not** under `examples/`, and prettier-ignored via `SUBTASK_*/`) drives each
program through the real `interpret()` facade (`src/index.ts`) via `tsx`
`tsImport` (the same loader `bin/klein.mjs` uses so `@contracts`/`@core` aliases
resolve). It reproduces the CLI runner (`src/cli/cli.ts#runSource`) exactly:

- `.out` = captured `print`/`println` sink bytes.
- `.diag` = for each diagnostic, `formatDiagnostic(d, source, { color:false })`
  followed by `"\n"` — byte-identical to the CLI's stderr.
- `kind` = `diagnostics.length > 0 ? "error" : "ok"`; `expectedCodes` =
  `diagnostics.map(d => d.code)` in source order.

Source name is the repo-root-relative `examples/<name>.kl`, so a golden is
identical whether reproduced in-process via
`interpret(source, { sourceName: "examples/<name>.kl" })` **or** by spawning the
shipped executable from the project root — a fact the E2E sibling relies on for
its true-process smoke test.

## Verification performed (all green)

- **Byte-for-byte against the real executable.** For all 10 examples,
  `NO_COLOR node bin/klein.mjs examples/<name>.kl` reproduces the committed
  goldens exactly: `ok` → exit `0`, stdout == `.out`, empty stderr; `error` →
  exit `1`, stdout == `.out`, stderr == `.diag`.
- **`index.json`** is valid JSON, 10 entries, matches the files on disk;
  `expectedCodes` match `interpret().diagnostics` in source order.
- **`npm run format:check`** (`prettier --check .`) — clean across the repo
  including the new `examples/**` (Prettier's directory discovery skips the
  `.kl`/`.out`/`.diag` extensions; `index.json` + `README.md` are Prettier-clean).

## Boundaries honored

Wrote **only** under `examples/**` (plus this `COMPLETE.md` and the scratch
generator in my own workspace). Did **not** modify `contracts/**`, `src/**`,
`bin/**`, or any sibling's subtree. No missing/inadequate upstream feature was
encountered — every example maps to a real, registered language feature, so no
plan amendment was required.

## Handoff to dependents

`SUBTASK_e2e_tests` (data-driven from `examples/index.json`) and, transitively,
`SUBTASK_verification` can consume `examples/**` as-is. To reproduce a `.diag`
in-process, pass `sourceName: "examples/<name>.kl"` to `interpret()`; the
true-process path is `node bin/klein.mjs examples/<name>.kl` from the project
root with `NO_COLOR` set.
