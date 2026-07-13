# SUSPENSION — `SUBTASK_scaffold` (NeedsDecompose)

**Status**: SUSPENDED · `decompose_evaluation = NeedsDecompose` · **Date**: 2026-07-13
**Process**: proc-ec2c2c3f-4055-4181-b447-5f2518d92aae
**Resumption condition (implicit)**: all four child tasks reach a terminal lifecycle state.

## Why this task decomposed (trigger evaluation)

`SUBTASK_scaffold`'s brief explicitly enumerates three distinct concerns and asks
for an honest atomicity evaluation. Applying the kernel triggers to the actual brief:

| Trigger family | Outcome | Basis |
|---|---|---|
| Scope-Based / enumerated-concerns | **FIRES** | Brief enumerates 3 concerns: tooling/config, `src/core`, docs |
| Distinct Concerns Test | **FIRES** | Build engineer / TS runtime engineer / technical writer could each own one in parallel |
| Single-Responsibility Rule | **FIRES** | "configure tooling AND implement core AND write docs" — three verbs/responsibilities |
| Output Size | **FIRES (MUST)** | ~19 owned files incl. a full `docs/LANGUAGE.md` spec, EBNF, 4 `src/core` modules + tests → ≫400 lines |
| Tool-call envelope | **FIRES** | ~20 files + build/lint/test iterations ≫ 15 calls |

No single-declared-output escape applies (many outputs). The persona's bias toward
one cohesive artifact is explicitly overridden by the kernel's mechanical
evaluation. **Verdict: decompose.**

## Subtree materialized (hub-and-spoke: precursor → parallel build → synthesis)

```
tooling ─┬─▶ core ──┐
         └─▶ docs ──┴─▶ verify
```

| Child (task id) | Responsibility | Depends on | Owned outputs |
|---|---|---|---|
| `scaffold.tooling` | Toolchain single source of truth (pinned deps, tsconfig aliases, lint/format/test/CI) | — | 9 config/CI files |
| `scaffold.core` | Shared `src/core/` (span, KleinError classes, DiagnosticFormatter) + tests | tooling | `src/core/**`, `tests/core/**` |
| `scaffold.docs` | README, LANGUAGE.md, GRAMMAR.md, LICENSE, CHANGELOG | tooling | 5 doc files |
| `scaffold.verify` | Synthesis: prove they compose; assert in-scope `_MANIFEST` identities | tooling, core, docs | `SYNTHESIS.md` (+ report) |

## Ownership partition (disjoint subdivision of `contracts/_MANIFEST.yaml` → ownership.scaffold)

The manifest assigns the full config/doc/`src/core` set to `scaffold` collectively;
the children partition it with no overlap (tooling → config; core → `src/core`+`tests/core`;
docs → README/LICENSE/CHANGELOG/`docs/`; verify writes only its own workspace).
`contracts/` remains read-only for all.

## Key decision handed to children

**Path-alias / import convention** (`_GLOBAL.md` §8): `tooling` must wire and prove
`@contracts`/`@core` resolving at compile **and** runtime, or fall back to a
documented relative-import convention. Whatever `tooling` proves, `core`, `docs`,
`verify`, and all later stages must follow — recorded in `tooling`'s `COMPLETE.md`.

## Named state authored before this suspension
- `SUBTASK_scaffold/_GLOBAL.md` (subtree hub)
- `SUBTASK_scaffold/SUBTASK_tooling/_BRIEF.md`
- `SUBTASK_scaffold/SUBTASK_core/_BRIEF.md`
- `SUBTASK_scaffold/SUBTASK_docs/_BRIEF.md`
- `SUBTASK_scaffold/SUBTASK_verify/_BRIEF.md`
- Four `engine_amend_plan { add_task }` calls applied (`scaffold.tooling`, `.core`, `.docs`, `.verify`).
