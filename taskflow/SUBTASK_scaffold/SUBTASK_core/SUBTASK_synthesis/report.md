# Verification report — `scaffold.core.synthesis`

**What this proves:** the three `core` build spokes (`span`, `errors`,
`diagnostic`) compose through the barrel `src/core/index.ts` and the whole subtree
meets every §10 success criterion of `../_GLOBAL.md`. **Every gate below was proven
by running the real toolchain command** (Node **v24.18.0** via nvm, npm 11.16.0 —
the same runtime the spokes proved against), not by assertion.

Reproduce from the project root
(`demos/language-interpreter/interpreter/`) with node on PATH
(`. "$HOME/.nvm/nvm.sh"`).

---

## 1. Gate commands run and observed results

| # | Command | Observed result | Exit |
|---|---|---|---|
| 1 | `npm run build` (`tsc -p tsconfig.build.json`, strict) | Clean type-check of the whole project incl. `src/core/index.ts` | **0** |
| 2 | `npm run lint` (`eslint .`, type-aware) | No findings across `src/core/**` + `tests/core/**` | **0** |
| 3 | `npm run format:check` (`prettier --check .`) | `All matched files use Prettier code style!` | **0** |
| 4 | `npm test` (`vitest run`) | **38 passed** (3 files: span 14, diagnostic 14, errors 10) | **0** |
| 5 | `npm run coverage` (`vitest run --coverage`, thresholds ≥90 enforced) | See §2 — all four metrics ≥90 on `src/core/`; thresholds bit and passed | **0** |
| 6 | `npx tsx …/compose_proof.ts` (end-to-end composition via `@core`) | `COMPOSITION PROOF: PASS` (8/8 structural checks) | **0** |

Notes:
- The barrel initially tripped `format:check` (Prettier wanted the long
  `export { … } from "./diagnostic"` wrapped). Fixed by `prettier --write
  src/core/index.ts` **on my own owned file only**; build + lint + format then all
  re-confirmed green (§1 rows 1–3 shown are the post-format re-runs).
- `build`/`lint`/`test`/`coverage` were run **after** the reformat, so the numbers
  above reflect the delivered barrel.

## 2. Coverage on `src/core/` (barrel excluded per `vitest.config.ts`)

```
File           | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------|---------|----------|---------|---------|------------------
All files      |   100   |  94.73   |   100   |   100   |
 diagnostic.ts |   100   |  91.42   |   100   |   100   | 73,78,161
 errors.ts     |   100   |   100    |   100   |   100   |
 span.ts       |   100   |   100    |   100   |   100   |

Statements : 100%   (199/199)
Branches   : 94.73% (54/57)
Functions  : 100%   (22/22)
Lines      : 100%   (199/199)
```

- **`src/core/index.ts` does not appear** — the barrel is coverage-excluded
  (`src/**/index.ts`), exactly as intended; barrels carry no logic.
- **≥90% bar cleared on all four metrics.** The 3 residual `diagnostic.ts`
  branches (lines 73/78/161) are the documented unreachable defensive fallbacks
  the `diagnostic` spoke left in place for safety (a `?? ""` under a
  `noUncheckedIndexedAccess`-forced guard, and the two mutually-exclusive
  `paint()` colour arms) — not gamed away.

## 3. End-to-end composition proof (the load-bearing synthesis check)

A throwaway script imported the span helpers, an error class, and the formatter
**exclusively through the `@core` barrel** (plus the `@contracts` vocabulary), then
walked the real pipeline path a stage takes:

```
makeSpan(makePosition(...), makePosition(...), "script.kl")
  → new RuntimeErr(ErrorCode.UndefinedVariable, "undefined variable 'foo'", span)
  → err.toDiagnostic()                       // Diagnostic, via errors → contract
  → formatDiagnostic(diagnostic, source)     // rendered string, via diagnostic
```

Rendered output (colorless), byte-verified against the `contracts/errors.ts`
`DiagnosticFormatter` docstring layout:

```
error[E3001]: undefined variable 'foo'
 --> script.kl:3:11
  |
3 |   let y = foo + 1;
  |           ^^^
```

This reproduces the contract's `error[Exxxx]: … / --> src:line:col / snippet /
caret` structure exactly (header → locator → gutter bar → snippet → caret run of
width 3 under `foo`). The only intentional divergence from the docstring is the
absent caret *label* (`^^^ not defined in this scope`): the `Diagnostic` contract
exposes a single `message` (rendered in the header) and no separate label field —
the `diagnostic` spoke documented this rather than confabulate a field, and the
**structural** layout matches. Structural assertions verified by the script (all
PASS):

1. header `error[E3001]: undefined variable 'foo'`
2. locator ` --> script.kl:3:11`
3. opening gutter `  |`
4. snippet `3 |   let y = foo + 1;`
5. caret `  |           ^^^` (length-3 run under `foo`)
6. `err instanceof Error` — real `Error` subclass interop
7. `diagnostic.code === ErrorCode.UndefinedVariable` — structural, code-keyed
8. `diagnostic.phase === "runtime"` — phase fixed by the concrete class

`build` (row 1) additionally type-checks that same barrel-mediated composition at
compile time; the proof shows it at **runtime** through the esbuild path (`tsx`),
matching the `@core`/`@contracts` runtime aliasing `tooling` proved.

> The proof script (`compose_proof.ts`) was a scratch artifact; its content is
> reproduced verbatim in §5 so the check is re-runnable, and the file itself was
> removed to keep this task's delivered outputs to exactly its three declared,
> exclusive owned paths.

## 4. Ownership / partition verification (§7 of the hub)

- **`contracts/` unmodified** — this task read `contracts/errors.ts` and
  `contracts/tokens.ts` (via `@contracts`) only; wrote nothing under `contracts/`.
- **Disjoint partition, no overlap, no gaps.** `src/core/` contains exactly
  `span.ts`, `errors.ts`, `diagnostic.ts` (one per build spoke) + `index.ts` (this
  task's barrel); `tests/core/` contains exactly `span.test.ts`, `errors.test.ts`,
  `diagnostic.test.ts`. Each spoke owns exactly one module + one suite; the barrel
  is the only `src/` addition here.
- **No write outside ownership.** This task wrote only `src/core/index.ts` and its
  own-workspace records (`report.md`, `SYNTHESIS.md`). No config, CI, docs, or
  spoke file was touched.

## 5. The composition-proof script (verbatim, for reproduction)

Run from the project root with `npx tsx <path-to-this-script>`:

```ts
import { makePosition, makeSpan, RuntimeErr, formatDiagnostic } from "@core";
import { ErrorCode } from "@contracts";
import type { KleinError } from "@contracts";

// Source mirrors the contract docstring example (`foo` undefined on line 3).
const source = ["let x = 1;", "", "  let y = foo + 1;"].join("\n");

// `foo` at line 3, columns 11..14 (1-based, UTF-16, end exclusive).
const span = makeSpan(makePosition(22, 3, 11), makePosition(25, 3, 14), "script.kl");

const err: KleinError = new RuntimeErr(
  ErrorCode.UndefinedVariable,
  "undefined variable 'foo'",
  span,
);
const rendered = formatDiagnostic(err.toDiagnostic(), source);
console.log(rendered);
// → reproduces the contracts/errors.ts header/locator/gutter/snippet/caret layout
```

(The delivered run used the same logic plus the eight explicit structural
assertions listed in §3; all passed, exit 0.)

## 6. Verdict

Every `../_GLOBAL.md` §10 criterion is satisfied and **proven by a real command
run** (exit 0 on build, lint, format:check, vitest, coverage, and the tsx
composition proof). The `core` subtree is complete and the public `@core` surface
(§ SYNTHESIS.md) is ready for downstream stages to import.
