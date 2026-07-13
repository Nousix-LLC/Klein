# SYNTHESIS — `scaffold.core` subtree (Klein shared runtime core)

**Task**: `scaffold.core.synthesis` (hub/synthesis of the `core` subtree).
**Decompose evaluation**: Atomic — reached independently against my own brief
(every trigger cleared; barrel + end-to-end verification is one cohesive synthesis
responsibility), matching the parent hub's expectation. **Status**: COMPLETED.

This record composes the three build spokes into the public `@core` surface, and
confirms — **by running the real toolchain** (Node v24.18.0), not by assertion —
that the subtree meets every `../_GLOBAL.md` §10 criterion. Full command log,
coverage table, and the end-to-end proof are in the companion `report.md`.

---

## 1. What the three spokes produced (all COMPLETE on entry)

| Spoke | Delivered module + tests | Responsibility | Isolated coverage |
|---|---|---|---|
| `scaffold.core.span` | `src/core/span.ts`, `tests/core/span.test.ts` (14) | Pure/total `Position`·`Span` geometry over the read-only `contracts/tokens.ts` shapes | 100 / 100 / 100 / 100 |
| `scaffold.core.errors` | `src/core/errors.ts`, `tests/core/errors.test.ts` (10) | Concrete `KleinErrorBase` + `LexicalError`/`SyntaxErr`/`RuntimeErr` — real `Error` subclasses that `implements contracts/errors.ts#KleinError` | 100 / 100 / 100 / 100 |
| `scaffold.core.diagnostic` | `src/core/diagnostic.ts`, `tests/core/diagnostic.test.ts` (14) | `DiagnosticFmt implements DiagnosticFormatter` — rustc-style header/locator/gutter/snippet/caret rendering | 100 / 91.42 / 100 / 100 |

My addition: **`src/core/index.ts`** — the `@core` barrel (coverage-excluded).

## 2. How they compose (the dependency story, proven end-to-end)

The DAG is `span → errors` (errors stores a `Span`, builds none itself), with
`diagnostic` independent (it depends only on `contracts/`). They meet at the
barrel and at runtime:

```
span helpers ──build a Span──▶ errors (KleinError.toDiagnostic(): Diagnostic)
                                          │
contracts/errors.ts#Diagnostic ◀──────────┘
                                          ▼
                         diagnostic (DiagnosticFormatter.format) ──▶ rendered string
```

The end-to-end proof (report.md §3) imports **only through `@core`** and walks
`makeSpan → new RuntimeErr(...) → .toDiagnostic() → formatDiagnostic(...)`,
producing exactly the `contracts/errors.ts` layout:

```
error[E3001]: undefined variable 'foo'
 --> script.kl:3:11
  |
3 |   let y = foo + 1;
  |           ^^^
```

`instanceof Error` holds, the diagnostic is code-keyed (`ErrorCode.UndefinedVariable`),
and `phase` is fixed by the class. The three modules interlock through the shared
`contracts/` vocabulary with zero drift — the contract types are imported literally
by every module, never re-declared.

## 3. §10 success criteria — all confirmed by a real command run

- [x] **`npm run build` (tsc strict) green** with all of `src/core/` + `index.ts`
      present; no `any` in the public surface. (exit 0)
- [x] **`npm run lint` and `npm run format:check` pass** on `src/core/**` +
      `tests/core/**`. (exit 0; barrel reformatted with Prettier on my own file.)
- [x] **`vitest run` green — 38 tests** (span 14 · diagnostic 14 · errors 10);
      **`npm run coverage` ≥90%** on `src/core/` on all four metrics
      (Stmts 100 · Branch 94.73 · Funcs 100 · Lines 100), **barrel excluded**. (exit 0)
- [x] **End-to-end**: an error class → `toDiagnostic()` → formatter reproduces the
      `error[Exxxx]: … / --> src:line:col / snippet / caret` contract layout. (exit 0)
- [x] **Error classes are real `Error` subclasses AND structurally satisfy
      `KleinError`** — verified live (`instanceof Error`, catchable, carry their span).
- [x] **`contracts/` unmodified; no write outside ownership; spokes disjoint** —
      `src/core/` = {span, errors, diagnostic, index}, `tests/core/` = the 3 suites;
      no overlap, no gaps (report.md §4).

## 4. Public `@core` surface downstream stages may rely on

Import behavior from `@core`; import the shared *types* from `@contracts` (the
barrel deliberately does **not** re-export contract types — single source of truth):

```ts
import {
  // span geometry (pure, total)
  makePosition, makeSpan, pointSpan, mergeSpans, spanLength,
  // concrete errors (throwable; .toDiagnostic() reduces to a contract Diagnostic)
  KleinErrorBase, LexicalError, SyntaxErr, RuntimeErr,
  // diagnostic rendering
  DiagnosticFmt, diagnosticFormatter, formatDiagnostic,
} from "@core";
import type { RenderOptions } from "@core";

// vocabulary stays in contracts:
import { ErrorCode, type Diagnostic, type Span, type KleinError } from "@contracts";
```

| Export | Kind | Use |
|---|---|---|
| `makePosition`, `makeSpan`, `pointSpan`, `mergeSpans`, `spanLength` | fns | Build/grow source ranges; `pointSpan` for EOF/missing-token carets; `spanLength` for caret width |
| `KleinErrorBase` | abstract class | `catch (e) { if (e instanceof KleinErrorBase) … }` then `e.toDiagnostic()` |
| `LexicalError` / `SyntaxErr` / `RuntimeErr` | classes | Thrown by lexer / parser / runtime respectively; `RuntimeErr` optionally carries `callStack: readonly StackFrame[]` (mapped to `Diagnostic.stack`) |
| `DiagnosticFmt` / `diagnosticFormatter` / `formatDiagnostic` | class / instance / fn | Render any `Diagnostic` + source to the human-readable snippet+caret string; `formatDiagnostic(d, source, { color })` is the convenience entry |
| `RenderOptions` | type | `{ readonly color?: boolean }` — ANSI toggle (off by default; stripping ANSI recovers byte-identical colorless output) |

**Conventions carried forward** (from `tooling/COMPLETE.md` §5, honored here):
extensionless relative imports inside `src/core/`; `@contracts`/`@core` aliases
(compile-time via tsconfig `paths`, runtime via Vitest alias + tsx/esbuild); Vitest
API imported explicitly (no globals); tests key off `ErrorCode` + structure, never
message text; full strict flag set (except `verbatimModuleSyntax`, off for the
read-only contracts); no `any` in any public surface.

## 5. Notes, deviations, and open items

- **Barrel scope decision (documented):** `@core` re-exports only the three
  modules' implementation surface, **not** the contract types. Downstream imports
  vocabulary from `@contracts` — one source of truth for shapes, `@core` for
  behavior. This is a deliberate, conventional choice, not an omission.
- **One documented render divergence (inherited from the `diagnostic` spoke):** the
  caret is unlabelled. The `Diagnostic` contract has a single `message` (rendered in
  the header) and no separate caret-label field; the docstring's illustrative `^^^
  not defined in this scope` label was not confabulated. Structural layout matches
  the contract exactly.
- **`RuntimeErr` call stack is `callStack`, not `stack`** — the native `Error.stack`
  string cannot be re-typed to `readonly StackFrame[]` (TS2416); `toDiagnostic()`
  threads `callStack` onto the contract's `Diagnostic.stack`. (From the `errors`
  spoke; unchanged here.)
- **Methodology bundle unavailable** (`agent_domain_unset`, per hub §9): methodology
  was taken from `contracts/`, the ancestor hubs, `tooling/COMPLETE.md`, and the
  briefs — all sufficient for this well-trodden interpreter-core work. No gap was
  confabulated across.
- **No amendment needed.** All three spoke outputs were adequate as delivered; the
  barrel required no patching of any spoke file (none was touched).

**Handoff:** `scaffold.core` is COMPLETE. `scaffold.verify` and every later Klein
stage (`lexer`/`parser`/`runtime`/`cli`) may now `import { … } from "@core"` per §4,
against a subtree that builds, lints, formats, tests, and covers ≥90% — proven by
real commands.
