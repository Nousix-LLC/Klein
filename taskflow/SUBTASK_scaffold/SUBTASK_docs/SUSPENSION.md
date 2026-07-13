# SUSPENSION — `SUBTASK_docs` (decomposed)

**Task**: Documentation — README, language spec, grammar, license, changelog.
**Decompose evaluation**: `NeedsDecompose`.
**Status**: SUSPENDED, awaiting the `docs` subtree's terminal resolution.
**Date**: 2026-07-13.

---

## 1. Why this task decomposed (triggers applied to the `docs` brief)

Boot reads: kernel boot-load set (Phase A), no application boot file named
(methodology loader → `agent_domain_unset`, as project hub §8 records), then the
`docs` brief, the scaffold hub `../_GLOBAL.md`, the project hub `../../_GLOBAL.md`,
all of `../../contracts/`, and the completed `tooling` outputs (`COMPLETE.md` +
the real `package.json`). Applying the decomposition triggers to my actual brief:

- **Output-Size — FIRES (MUST decompose):** the authoritative `docs/LANGUAGE.md`
  alone (values, scope, operator precedence, control flow, closures, truthiness,
  equality, literals, error model) is ~400–600 lines; with the full-EBNF
  `docs/GRAMMAR.md`, `README.md`, `LICENSE`, and `CHANGELOG.md` the set is ≫ 400
  lines.
- **Scope / Distinct-Concerns — FIRES:** the language-semantics spec, the formal
  EBNF grammar, and the project onboarding/meta docs are things different
  specialists could author in parallel from the same fixed `contracts/`.
- **Single-Responsibility — FIRES:** a faithful description conjoins distinct verbs
  — *specify* semantics **and** *formalize* the grammar **and** *write* onboarding
  docs.
- **Token (input)** clears (inputs are small), but per Trigger Precedence a cleared
  weak trigger cannot cancel fired scope/output triggers.

The `docs` brief itself explicitly invited this split ("language spec vs. grammar
vs. project docs"). Per the kernel's asymmetric bias (under-decomposition is
catastrophic; over-decomposition is cheap), and because my own engineering instinct
toward one cohesive doc set carries no weight at the evaluation point, the verdict
is `NeedsDecompose`.

## 2. The subtree I materialized (hub-and-spoke)

Subtree hub authored at `./_GLOBAL.md` (records the fixed ground truth — value
kinds, operators + precedence source, `ErrorCode` set, truthiness/equality rules,
toolchain facts, formatting — that all children inherit and MUST not drift from).

| Child (id / slug) | Responsibility | Depends on | Owned output(s) |
|---|---|---|---|
| `docs_language` / `language` | Authoritative language-semantics spec | — | `docs/LANGUAGE.md` |
| `docs_grammar` / `grammar` | Formal EBNF grammar (mirrors AST + precedence) | `docs_language` | `docs/GRAMMAR.md` |
| `docs_project` / `project` | Project onboarding/meta docs | — | `README.md`, `LICENSE`, `CHANGELOG.md` |
| `docs_synthesis` / `synthesis` | Cross-document consistency verification + `format:check` | `docs_language`, `docs_grammar`, `docs_project` | *(own workspace)* `SYNTHESIS.md` |

```
language ─┬─▶ grammar ─┐
project ──┴────────────┴─▶ synthesis
```

Ownership is disjoint and exactly partitions this task's owned outputs; no child
writes outside its set, under `src/`/`tests/`/tooling, or into `contracts/`.
`grammar` depends on `language` so it mirrors the finished, authoritative
precedence table rather than re-deriving it (anti-drift). Each child re-runs its
own atomic-vs-decompose evaluation at dispatch; all four are expected atomic.

Each child `_BRIEF.md` is authored at its workspace root; all four `add_task`
amendments were accepted (DAG groups: language+project in group 0, grammar in
group 1, synthesis in group 2).

## 3. Resumption

This task remains SUSPENDED until the entire `docs` subtree resolves to terminal
states. The `docs_synthesis` `SYNTHESIS.md` is the subtree's consolidated record
and PASS/FAIL verdict, which the scaffold-level `SUBTASK_verify` consumes when it
proves tooling + core + docs compose end-to-end.

## 4. No substantive work executed here

Per the kernel, a decomposing parent does not execute any child's work. No project
documentation file was authored by this invocation; this invocation only authored
the subtree hub, the four child briefs, and this record.
