# SUSPENSION — `scaffold.core` (NeedsDecompose)

**Status**: SUSPENDED · `decompose_evaluation = NeedsDecompose` · **Date**: 2026-07-13
**Process**: proc-7e27a0a1-7286-45a1-baa2-389b64d4aed9
**Resumption condition (implicit)**: all four child tasks reach a terminal lifecycle state.

## Why this task decomposed (trigger evaluation)

`scaffold.core`'s brief implements the shared `src/core/` runtime core and
explicitly delegated the atomicity call to me (*"Three distinct modules … if your
reading finds they warrant separate atomic tasks … decompose — that judgement is
yours"*). Applying the kernel triggers to the actual brief:

| Trigger family | Outcome | Basis |
|---|---|---|
| Scope-Based / enumerated-concerns | **FIRES** | Three distinct modules enumerated: span helpers, error classes, diagnostic renderer |
| Distinct Concerns Test | **FIRES** | `span.ts` is independent; `diagnostic.ts` (Diagnostic→string) is independent of `errors.ts`; only errors→span is serial — separable specialists |
| Single-Responsibility Rule | **FIRES** | span *geometry* vs. error *classes* vs. *rendering* = three kinds of change and output |
| Output Size | **FIRES (MUST)** | 4 source modules + 3 test suites ≈ 700–900 lines ≫ 400 |
| Tool-call envelope | **FIRES** | 7 files + build/lint/coverage iterations ≫ 15 calls |

No single-declared-output escape applies (7 owned outputs). The principal-engineer
bias toward one cohesive artifact is explicitly overridden by the kernel's
mechanical evaluation. **Verdict: decompose.**

## Subtree materialized (hub-and-spoke: precursor → parallel build → synthesis)

```
span ──┬──▶ errors ───┐
       │              ├──▶ synthesis
       diagnostic ────┘
```

| Child (task id) | Responsibility | Depends on | Owned outputs |
|---|---|---|---|
| `scaffold.core.span` | Position/Span construction + merge/utility helpers | — | `src/core/span.ts`, `tests/core/span.test.ts` |
| `scaffold.core.diagnostic` | `DiagnosticFormatter`: snippet + caret rendering | — | `src/core/diagnostic.ts`, `tests/core/diagnostic.test.ts` |
| `scaffold.core.errors` | `LexicalError`/`SyntaxErr`/`RuntimeErr` implementing `KleinError` | span | `src/core/errors.ts`, `tests/core/errors.test.ts` |
| `scaffold.core.synthesis` | Barrel + prove the three compose & hit ≥90% coverage | span, errors, diagnostic | `src/core/index.ts`; `SYNTHESIS.md` + report |

Observed group assignment after the amendments: `span`/`diagnostic` in Group 0,
`errors` in Group 1, `synthesis` in Group 2 — matching the intended DAG.

## Ownership partition (disjoint subdivision of `src/core/**` + `tests/core/**`; no overlap)

- **span** → `src/core/span.ts`, `tests/core/span.test.ts`
- **diagnostic** → `src/core/diagnostic.ts`, `tests/core/diagnostic.test.ts`
- **errors** → `src/core/errors.ts`, `tests/core/errors.test.ts`
- **synthesis** → `src/core/index.ts` (barrel) + its own workspace artifacts only

No two children write the same path; none writes outside the `core` ownership set;
`contracts/`, config, and docs stay read-only for all.

## Key conventions handed down to children (from `tooling`'s `COMPLETE.md` §5)

Import contract types from `@contracts`; extensionless relative imports within
`src/core/` (`moduleResolution: "bundler"` + esbuild runtime — no `.ts`/`.js`
extensions, aliases proven at compile AND runtime); import the Vitest API
explicitly (no globals); tests key off `ErrorCode`/structure, never message text;
strict flags stay on; ≥90% coverage (barrels excluded).

## Methodology gap (inherited, documented — not confabulated)

Engine software methodology bundle unavailable (`agent_domain_unset` from
`methodology_glob`). Methodology is encoded in `contracts/`, the ancestor hubs,
`tooling`'s `COMPLETE.md`, and these briefs — standard interpreter-core practice. A
child dispatched with the bundle available SHOULD load and reconcile it.

## Named state authored before this suspension
- `SUBTASK_scaffold/SUBTASK_core/_GLOBAL.md` (this subtree's hub)
- `SUBTASK_scaffold/SUBTASK_core/SUBTASK_span/_BRIEF.md`
- `SUBTASK_scaffold/SUBTASK_core/SUBTASK_diagnostic/_BRIEF.md`
- `SUBTASK_scaffold/SUBTASK_core/SUBTASK_errors/_BRIEF.md`
- `SUBTASK_scaffold/SUBTASK_core/SUBTASK_synthesis/_BRIEF.md`
- Four `engine_amend_plan { add_task }` calls applied: `scaffold.core.span`,
  `.diagnostic`, `.errors`, `.synthesis`.
