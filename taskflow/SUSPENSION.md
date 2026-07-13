# SUSPENSION — Klein interpreter root decomposition

**Task**: root (`TASK_ROOT_DECOMPOSE`) · **Status**: SUSPENDED
**Decompose evaluation**: `NeedsDecompose`
**Date**: 2026-07-13

## Why suspended
The root request — "build a real, production-ready interpreter for a small
dynamic language in TypeScript/Node" — fired every kernel decomposition trigger
(token, scope/multiple-system-components, output-size, Distinct-Concerns,
Single-Responsibility, and the "draw the rest of the owl" test). It is not an
atomic task. I therefore authored the subtree named-state and a machine-verifiable
contract, materialized seven child tasks, and now suspend pending their resolution.

## What I authored (all observable before this suspension)
- **Hub**: `_GLOBAL.md` — objectives, quality bar, the Klein language summary,
  architecture, contract index, task DAG, conventions, and the methodology gap note.
- **Contract layer** (`contracts/`, READ-ONLY for descendants):
  `tokens.ts`, `ast.ts`, `values.ts`, `errors.ts`, `pipeline.ts`, `index.ts`,
  and `_MANIFEST.yaml` (ownership + integration identities). This is the
  compositional schema that lets the stages compose without drift.
- **Seven child briefs**: `SUBTASK_{scaffold,lexer,parser,runtime,stdlib,cli,integration}/_BRIEF.md`.

## Child subtree (serial pipeline; precursor → transform → synthesis)
```
scaffold ─▶ lexer ─▶ parser ─▶ runtime ─▶ stdlib ─▶ cli ─▶ integration
(Group 0)   (G1)     (G2)       (G3)        (G4)      (G5)   (G6, synthesis hub)
```
Serial dependencies are deliberate: each stage receives the real, completed
upstream implementation to integrate and test against, maximizing correctness.
Each child independently re-runs its own atomic-vs-decompose evaluation; `parser`
and `runtime` are the likeliest to decompose further, which is expected and correct.

| Task | Responsibility | Depends on |
|---|---|---|
| scaffold | tooling, config, docs, shared `src/core` | — |
| lexer | source → Token[] | scaffold |
| parser | Token[] → AST (Pratt, recovering) | scaffold, lexer |
| runtime | AST → Value (env, closures, control flow) | scaffold, parser |
| stdlib | builtins + registry | runtime |
| cli | interpret() facade, CLI, REPL, bin | stdlib |
| integration | examples, E2E/golden tests, integrity checks | cli |

## Resumption condition
All seven child tasks reach terminal lifecycle states. The `integration` task is
the synthesis hub: it asserts the `_MANIFEST.yaml` identities (build, lint, format,
tests, coverage ≥90%, contract immutability, ownership, examples-match-golden) and
authors `SYNTHESIS.md` as the final self-contained account of the delivered
interpreter.

## Notes for downstream tasks
- Treat `contracts/` as immutable ground truth; import declarations literally.
  If a contract is inadequate, request an **additive** plan amendment — do not edit it.
- The software methodology bundle was unavailable at root (`agent_domain_unset`);
  methodology is encoded in the hub + contracts + briefs. A child dispatched with
  the bundle available should load and reconcile it.
