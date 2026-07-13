# Task: Core synthesis — barrel + prove `src/core/` composes

**Slug**: `synthesis` · **Task id**: `scaffold.core.synthesis` · **Depends on**:
`span`, `errors`, `diagnostic` (`scaffold.core.span`/`.errors`/`.diagnostic`).
**Dependents**: `scaffold.core` (this subtree's completion) → `scaffold.verify` and
every later Klein stage that imports `@core`.

## Objective
Author the `src/core/index.ts` barrel that exposes the public core surface, then
verify end-to-end that span + errors + diagnostic **compose** and meet the core
subtree success criteria (build/lint/format green, `tests/core/` green, ≥90%
coverage on `src/core/`, formatter reproduces the contract layout). Record the
result as this subtree's synthesis.

## Context
Hub/synthesis task of the Klein `core` subtree (see `../_GLOBAL.md`). All three
build spokes are COMPLETE when you run: read each one's `COMPLETE.md` and its
delivered module to know the real exported surface before writing the barrel.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree success criteria (§10), ownership (§7), import convention (§5).
- `../SUBTASK_span/COMPLETE.md` + `src/core/span.ts`
- `../SUBTASK_errors/COMPLETE.md` + `src/core/errors.ts`
- `../SUBTASK_diagnostic/COMPLETE.md` + `src/core/diagnostic.ts`
- `../../../contracts/errors.ts` — the layout the formatter must reproduce (for the
  end-to-end composition check).
- `../../SUBTASK_tooling/COMPLETE.md` §5 — the exact commands/conventions.

## Owned outputs (exclusive — write ONLY these)
- `src/core/index.ts` — barrel re-exporting the public core surface (span helpers,
  the concrete error classes + their types, the `DiagnosticFormatter`
  implementation) so downstream stages `import { … } from "@core"`. Re-export only
  the intended public surface; no `any`. (Barrels are coverage-excluded per
  `vitest.config.ts`.)
- `<own workspace>/report.md` — the verification report: each gate command run and
  its observed exit status / coverage numbers, and a short end-to-end composition
  proof (construct a `Diagnostic` via an error class's `toDiagnostic()`, render it
  through the formatter, and show it reproduces the `contracts/errors.ts` layout).
- `<own workspace>/SYNTHESIS.md` — the subtree synthesis record (what the three
  spokes produced, how they compose, confirmation of every §10 criterion, and the
  public `@core` surface downstream stages may rely on).

Write NOTHING under `src/`/`tests/` except `src/core/index.ts`. Do not modify
`contracts/`, config, docs, or the spokes' delivered files (if a spoke's output is
inadequate, report it — do not silently patch it).

## Success criteria (the core subtree's §10, verified here by running the gate)
- [ ] `npm run build` (tsc strict) green with all of `src/core/` + `index.ts` present.
- [ ] `npm run lint` and `npm run format:check` pass across `src/core/**` + `tests/core/**`.
- [ ] `vitest run` green; `npm run coverage` shows **≥90%** lines/branches/functions/
      statements on `src/core/` (barrel excluded).
- [ ] End-to-end: an error class → `toDiagnostic()` → formatter reproduces the
      `error[Exxxx]: … / --> src:line:col / snippet / caret` layout from `contracts/errors.ts`.
- [ ] `contracts/` unmodified; no file written outside this task's ownership; the
      three spokes stayed within their partitions (no overlap, no gaps).
- Terminal artifact is `SYNTHESIS.md` (subtree synthesis), reported as the completed
  task's `artifact_path`.

## Constraints
- Follow `tooling`'s `COMPLETE.md` §5 conventions exactly (commands, import style,
  strictness). Prove gates by **running the real commands**, not by assertion.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch (expected atomic —
barrel + verification is one cohesive synthesis responsibility).
