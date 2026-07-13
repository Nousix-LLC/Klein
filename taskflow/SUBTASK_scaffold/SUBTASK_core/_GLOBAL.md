# Klein — `core` subtree hub (`_GLOBAL.md`)

**Subtree hub.** Shared, write-once context for every task in the `scaffold.core`
decomposition. Each child reads this file, its own `SUBTASK_*/_BRIEF.md`, the
ancestor hubs (`../_GLOBAL.md` = scaffold, `../../_GLOBAL.md` = project), the
dependency `../SUBTASK_tooling/COMPLETE.md`, and treats `../../contracts/` as
**read-only** ground truth.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Parent**: `scaffold.core`
(see `./_BRIEF.md`). **Process**: proc-7e27a0a1-7286-45a1-baa2-389b64d4aed9.

---

## 1. Why this subtree exists (trigger evaluation)

`scaffold.core`'s brief (`./_BRIEF.md`) implements the shared runtime core every
Klein stage imports, and explicitly asks for an honest atomic-vs-decompose call:
*"Three distinct modules (span / errors / diagnostic renderer) live here; if your
reading finds they warrant separate atomic tasks (the renderer especially can be
substantial), decompose."* Applying the kernel triggers to the actual brief:

| Trigger family | Outcome | Basis |
|---|---|---|
| Scope-Based / enumerated-concerns | **FIRES** | Three distinct modules enumerated: span helpers, error classes, diagnostic renderer |
| Distinct Concerns Test | **FIRES** | `span.ts` is independent; `diagnostic.ts` (Diagnostic→string) is independent of `errors.ts`; only errors→span is serial — separable specialists |
| Single-Responsibility Rule | **FIRES** | span *geometry* vs. error *classes* vs. *rendering* are three kinds of change and three kinds of output |
| Output Size | **FIRES (MUST)** | 4 source modules + 3 test suites ≈ 700–900 lines ≫ 400 |
| Tool-call envelope | **FIRES** | 7 files + build/lint/coverage iterations ≫ 15 calls |

The principal-engineer instinct ("one cohesive small library — splitting is
overhead") is precisely the reasoning the kernel forbids as grounds for `Atomic`.
Multiple triggers fire. **Verdict: decompose.**

## 2. Objective (subtree)

Deliver `src/core/**` + `tests/core/**`: the span/position helpers, the concrete
`KleinError` classes, and the diagnostic renderer that **every** later Klein stage
imports — strict, `any`-free in the public surface, ≥90% covered, and rendering
the exact `contracts/errors.ts` snippet+caret layout.

## 3. Scope

**In scope (this subtree):** `src/core/span.ts`, `src/core/errors.ts`,
`src/core/diagnostic.ts`, `src/core/index.ts`, and `tests/core/**`; plus
end-to-end verification that the three compose and hit the coverage bar.

**Out of scope:** any pipeline stage source (`src/lexer`, `src/parser`, …), any
config/CI file (owned by `tooling`), any doc (owned by `docs`), and editing
`contracts/`. Do not create or touch those.

## 4. Inherited constraints (binding on every child)

From `../_GLOBAL.md` §4 and `../../_GLOBAL.md` §7, and the **binding conventions in
`../SUBTASK_tooling/COMPLETE.md` §5** (the proven toolchain — follow it, do not
substitute):

- **TypeScript strict**, ESM, Node ≥ 18.18. Test runner **Vitest**; lint
  **ESLint** + **Prettier**. All must stay green.
- **No `any`** in exported/public surface. Prefer discriminated unions +
  exhaustive `switch` with a `never` default arm where branching on
  `ErrorPhase`/`ErrorCode`/token kinds.
- **Errors always carry a `Span`.** Concrete classes `extends Error` **and**
  `implements contracts/errors.ts#KleinError`.
- **Tests key off `ErrorCode`** and structured fields, **never** on human-readable
  message text.
- One responsibility per module; the subtree exposes a barrel `src/core/index.ts`
  (authored by the synthesis task).

## 5. Import convention (FIXED by `tooling` — `COMPLETE.md` §5) — use exactly this

`tooling` proved the aliases resolve at compile **and** runtime, so the
relative-import fallback is **not** needed:

- Import contract types from the alias: `import { ErrorCode, Diagnostic, KleinError,
  Span, Position, StackFrame, ErrorPhase, Severity } from "@contracts";`
- Import **within `src/core/`** with **extensionless relative** paths:
  `import { makeSpan } from "./span";` (NOT `@core/span` from inside core itself,
  and NO `.ts`/`.js` extension — `moduleResolution: "bundler"` + esbuild runtime).
- Tests import the module under test with an extensionless relative path from
  `tests/core/` (e.g. `import { DiagnosticFmt } from "../../src/core/diagnostic";`)
  or via `@core`; and import the Vitest API explicitly
  (`import { describe, it, expect } from "vitest";` — **no globals**).
- Never paraphrase or re-declare contract types; import them literally.

## 6. Task structure & dependency DAG (precursor → parallel build → synthesis)

```
span ──┬──▶ errors ───┐
       │              ├──▶ synthesis
       diagnostic ────┘
```

| Task (id) | Responsibility (one kind of change) | Depends on | Owned outputs |
|---|---|---|---|
| `scaffold.core.span` | Position/Span construction + merge/utility helpers | — | `src/core/span.ts`, `tests/core/span.test.ts` |
| `scaffold.core.errors` | Concrete `LexicalError`/`SyntaxErr`/`RuntimeErr` classes | span | `src/core/errors.ts`, `tests/core/errors.test.ts` |
| `scaffold.core.diagnostic` | `DiagnosticFormatter`: snippet + caret rendering | — | `src/core/diagnostic.ts`, `tests/core/diagnostic.test.ts` |
| `scaffold.core.synthesis` | Barrel + prove the three compose & hit ≥90% coverage | span, errors, diagnostic | `src/core/index.ts`; `SYNTHESIS.md` + report (own workspace) |

`span` and `diagnostic` are independent (Group 0). `errors` follows `span`.
`synthesis` is the hub. Each child re-runs its OWN atomic-vs-decompose evaluation
at dispatch (per the kernel's independent-evaluation rule) — each is expected to be
genuinely atomic (one module + its tests), but that judgement is the child's.

## 7. Ownership split (disjoint partition of `src/core/**` + `tests/core/**`; NO overlap)

- **span** → `src/core/span.ts`, `tests/core/span.test.ts` — only.
- **errors** → `src/core/errors.ts`, `tests/core/errors.test.ts` — only.
- **diagnostic** → `src/core/diagnostic.ts`, `tests/core/diagnostic.test.ts` — only.
- **synthesis** → `src/core/index.ts` (barrel) + its own workspace artifacts only.

No two children write the same path. No child writes outside `src/core/**` /
`tests/core/**` (synthesis also writes only its own workspace). `contracts/`,
config, and docs are read-only for all.

## 8. Contract surface each child implements (from `../../contracts/`)

- `contracts/tokens.ts` → `Position` (offset, 1-based line, 1-based UTF-16 column),
  `Span` (half-open `[start, end)` + `source` name). **span** builds helpers around
  these shapes.
- `contracts/errors.ts` → `ErrorCode` (enum, phase-grouped `E1xxx`/`E2xxx`/`E3xxx`),
  `ErrorPhase` (`"lexical"|"syntax"|"runtime"`), `Severity`, `StackFrame`
  (`functionName`, `span`), `Diagnostic` (severity, phase, code, message, span,
  optional `stack`), `KleinError` (name, phase, code, message, span,
  `toDiagnostic()`), `DiagnosticFormatter` (`format(diagnostic, source, options?)`).
  **errors** implements `KleinError`; **diagnostic** implements `DiagnosticFormatter`.

## 9. Methodology posture (inherited)

The engine's software methodology bundle is unavailable (`agent_domain_unset`; see
`../../_GLOBAL.md` §8). Methodology is encoded in `contracts/`, the ancestor hubs,
`tooling`'s `COMPLETE.md`, and these briefs — standard, well-trodden
interpreter-core practice. When a step is underspecified, prefer the boring,
conventional choice and **document it**; never confabulate across a gap.

## 10. Subtree success criteria (verified by `scaffold.core.synthesis`)

- [ ] `npm run build` (tsc strict) green with all of `src/core/` present; no `any` leak.
- [ ] `npm run lint` and `npm run format:check` pass on the new files.
- [ ] `tests/core/` pass under `vitest run`, **≥90%** line/branch/function/statement
      coverage on `src/core/` (barrels excluded per `vitest.config.ts`).
- [ ] A sample `Diagnostic` rendered through the formatter reproduces the
      `error[Exxxx]: … / --> src:line:col / snippet / caret` layout in
      `contracts/errors.ts`.
- [ ] Error classes are real `Error` subclasses **and** structurally satisfy
      `KleinError` (interoperate with `throw`/stack).
- [ ] `contracts/` unmodified; no child wrote outside its ownership subtree.
