# SUSPENSION — `runtime` (NeedsDecompose)

**Status**: SUSPENDED · `decompose_evaluation = NeedsDecompose` · **Date**: 2026-07-13
**Process**: proc-c816af5a-502d-42d0-add6-52a24b7693a7
**Resumption condition (implicit)**: all three child tasks reach a terminal lifecycle state.

## Why this task decomposed (trigger evaluation)

`SUBTASK_runtime/_BRIEF.md` explicitly enumerates **three cohesive-but-distinct
concerns** and asks for an honest atomicity evaluation. Applying the kernel
triggers to the actual brief:

| Trigger family | Outcome | Basis |
|---|---|---|
| Scope-Based / enumerated-concerns | **FIRES** | Brief names 3 concerns: value system, environment, evaluator |
| Distinct Concerns Test (parallel) | **FIRES** | Value-system and environment can be built independently in parallel; evaluator synthesizes both |
| Single-Responsibility Rule | **FIRES** | "value system AND environment AND evaluator" — three verbs, three kinds of output |
| Output Size | **FIRES (MUST)** | Evaluator alone ≫400 lines; combined `src/runtime/**` + `tests/runtime/**` at ≥90% coverage far exceeds threshold |
| Tool-call envelope | **FIRES** | 4 source modules + comprehensive tests + build/lint/test iterations ≫15 calls |

Output-size framing ("one owned subtree `src/runtime/**`") MUST NOT override the
fired scope/concern triggers (Trigger Precedence). The persona's bias toward a
single cohesive runtime module is explicitly overridden by the kernel's mechanical
evaluation. **Verdict: decompose.**

## Subtree materialized (precursor ∥ precursor → synthesis)

```
runtime.values ──────┐
                     ├──▶ runtime.evaluator   (synthesis hub + subtree barrel)
runtime.environment ─┘
```

| Child (task id) | Responsibility | Depends on | Owned outputs |
|---|---|---|---|
| `runtime.values` | Value system: constructors, structural `==`, truthiness, canonical stringifier | `scaffold`, `parser` | `src/runtime/values.ts`, `tests/runtime/values.test.ts` |
| `runtime.environment` | `Environment` lexical scope chain (shadowing, `UndefinedVariable`) | `scaffold`, `parser` | `src/runtime/environment.ts`, `tests/runtime/environment.test.ts` |
| `runtime.evaluator` | Tree-walking `Interpreter` composing values+environment; control-flow signals, closures, call stack, `StackOverflow`, injectable builtins; runtime subtree barrel | `runtime.values`, `runtime.environment`, `parser` | `src/runtime/interpreter.ts`, `src/runtime/index.ts`, `tests/runtime/interpreter.test.ts` |

`runtime.values` and `runtime.environment` are independent (dispatched in
parallel, group 3). `runtime.evaluator` (group 4) is the synthesis hub: it imports
the two real modules, composes them into a working `Interpreter`, owns the runtime
subtree barrel `src/runtime/index.ts`, and proves the runtime end-to-end against
the **real** lexer+parser. `runtime.evaluator` may itself re-run its atomic-vs-
decompose evaluation and sub-decompose (expression-eval / statement+control-flow /
call-machinery) — its brief names those concerns for an honest evaluation.

## Ownership partition (disjoint subdivision of `_MANIFEST.yaml` → ownership.runtime)

The manifest assigns `src/runtime/**` + `tests/runtime/**` to `runtime`
collectively; the children partition it with **no overlap** (values → `values.ts`;
environment → `environment.ts`; evaluator → `interpreter.ts` + `index.ts`), each
with its matching `tests/runtime/*.test.ts`. `contracts/` remains read-only for all;
no child writes another child's file.

## Downstream unaffected

`stdlib` continues to depend on `runtime` (this task), which remains non-terminal
until this subtree resolves; no rewiring was needed. On resume, `runtime` verifies
the composed `src/runtime` builds (`tsc` strict), lints/formats clean, its tests
pass at ≥90% coverage, and the `_MANIFEST` identity `implements: [Value,
Environment, Interpreter]` holds — then reports completion so `stdlib` proceeds.

## Named state authored before this suspension
- `SUBTASK_runtime/_GLOBAL.md` (subtree hub)
- `SUBTASK_runtime/SUBTASK_values/_BRIEF.md`
- `SUBTASK_runtime/SUBTASK_environment/_BRIEF.md`
- `SUBTASK_runtime/SUBTASK_evaluator/_BRIEF.md`
- Three `engine_amend_plan { add_task }` calls applied (`runtime.values`,
  `runtime.environment`, `runtime.evaluator`).
