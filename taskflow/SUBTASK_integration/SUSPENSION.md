# SUSPENSION — `integration` task decomposition

**Task**: `integration` (Klein synthesis hub) · **Status**: SUSPENDED
**Decompose evaluation**: `NeedsDecompose` · **Date**: 2026-07-13

## Why suspended (decompose-evaluation)
My brief (`./_BRIEF.md`) enumerates **three distinct concerns over three distinct
kinds of artifact**: (1) example programs + golden outputs (`examples/**`), (2) an
end-to-end / error test harness (`tests/integration/**`, `tests/errors/**`), and (3)
mechanical integrity verification + a synthesis record (`SYNTHESIS.md`). Applying the
kernel triggers to my actual brief at dispatch:

- **Scope / enumerated-concerns** — fires (three enumerated areas).
- **Output-size** — fires (three distinct kinds of output; >400 lines aggregate).
- **Distinct-Concerns Test** — fires (test-data authoring / QA harness / release gate
  are different specialties).
- **Single-Responsibility Test** — fires (a serial precursor→transform→synthesis
  pipeline: examples → tests that consume them → verification of the composed whole).

Trigger precedence: the single `SYNTHESIS.md` deliverable does not cancel the fired
scope/concern signals. The brief's "single responsibility: integration & verification"
framing and my own engineering instinct that this is one cohesive hub carry no weight
at the mechanical evaluation point. Verdict: **NeedsDecompose**.

## What I authored (all observable before this suspension)
- **Subtree hub**: `SUBTASK_integration/_GLOBAL.md` — decomposition rationale, the
  ownership partition (staying inside `integration`'s manifest ownership), **the shared
  example/golden contract** (§3: `<name>.kl` / `<name>.out` / `<name>.diag` /
  `index.json`), how to run Klein (§4), inherited conventions, and the child DAG.
- **Three child briefs** (each at its child `workspace_path`):
  `SUBTASK_examples/_BRIEF.md`, `SUBTASK_e2e_tests/_BRIEF.md`,
  `SUBTASK_verification/_BRIEF.md`.
- **Three `add_task` amendments** materializing the children in the DAG.

## Child subtree (serial pipeline; precursor → transform → synthesis)
```
SUBTASK_examples ─▶ SUBTASK_e2e_tests ─▶ SUBTASK_verification
```
| Child | Responsibility | Depends on | Owns |
|---|---|---|---|
| `SUBTASK_examples` | example `.kl` programs + generated goldens + `index.json` | — (cli already COMPLETED) | `examples/**` |
| `SUBTASK_e2e_tests` | data-driven E2E + error suites over the examples | `SUBTASK_examples` | `tests/integration/**`, `tests/errors/**` |
| `SUBTASK_verification` | run all `_MANIFEST.yaml` identities; author `SYNTHESIS.md` | `SUBTASK_e2e_tests` | `SYNTHESIS.md` |

Children collectively write exactly `integration`'s manifest ownership
(`examples/**`, `tests/integration/**`, `tests/errors/**`) plus the synthesis record —
no overlap, nothing outside it. Each child re-runs its own atomic-vs-decompose
evaluation at dispatch; all three are expected atomic (one kind of output each).

## Resumption condition
All three child tasks reach terminal lifecycle states. The `verification` child is the
synthesis spoke: it asserts the `_MANIFEST.yaml` identities (compiles, lint, format,
tests, coverage ≥90%, contract immutability, ownership, examples-match-golden,
no-any-leak) and authors `SYNTHESIS.md` as the final self-contained GO/NO-GO account of
the delivered interpreter — failing loudly and naming the responsible task on any miss,
never silently patching.
