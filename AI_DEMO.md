# How Klein Was Built — Prompt, Output, and a Reviewer's Guide

Klein was generated **end to end by an autonomous multi-agent taskflow engine**
([Nousix](https://github.com/Nousix-LLC)) from a single one-paragraph prompt. No
human wrote any of the source, tests, or docs. This page shows the exact prompt,
how the engine turned it into a working interpreter, what came out, and — the
part that matters most — **how to review AI-generated code like this with real
rigor.**

The complete, unedited build record is preserved in [`taskflow/`](taskflow)
(engine access tokens and agent system prompts were the only things removed
before publishing).

---

## 1. The prompt — the *entire* human input

> **Build a real, production-ready interpreter for a small dynamic programming
> language in TypeScript/Node. This should be high quality code ready for
> production at google/meta, not a toy project for an interview.**

That is the whole specification. It contains **no design decisions**: no
architecture, no file layout, no language grammar, no semantics, no test plan,
no dependency choices. The engine decided all of it — that it should be a
tree-walker (not a bytecode VM), the language's syntax and semantics, the
module boundaries, the contract layer, the test strategy, and the tooling.

---

## 2. How the engine built it (the taskflow)

The root agent read the prompt, judged it too large for one pass, and
**decomposed** it. Rather than write code immediately, it first froze a shared
**interface contract** ([`taskflow/contracts/`](taskflow/contracts)) — the
types every component must agree on (`tokens`, `ast`, `values`, `errors`, and
the `pipeline` interfaces) — so that independent agents could build against a
stable seam instead of each other's guesses.

It then split the work along the classic interpreter pipeline, one agent per
stage, with a final gate that proves the whole thing composes:

```
scaffold ─▶ lexer ─▶ parser ─▶ runtime ─▶ stdlib ─▶ cli ─▶ integration
```

| Stage (`SUBTASK_*`) | Responsibility | Depends on |
|---|---|---|
| `scaffold` | Tooling, config, docs, shared `src/core/` (spans, diagnostics, errors) | — |
| `lexer` | Source → `Token[]` (error-tolerant) | scaffold |
| `parser` | `Token[]` → AST (Pratt, recovering) | scaffold, lexer |
| `runtime` | AST → `Value` (environments, closures, control flow) | scaffold, parser |
| `stdlib` | Builtin functions + registry | runtime |
| `cli` | `interpret()` facade, CLI, REPL, `bin/` | stdlib |
| `integration` | Examples, golden/E2E tests, **release-gate verification** | cli |

Several of these **recursively decomposed** further — e.g. `scaffold → core →
{span, diagnostic, errors, synthesis}`, `runtime → {environment, values,
evaluator}`, `cli → {facade, repl, runner, synthesis}`. In total the build ran
**30 independent agent invocations** across the tree. Each one booted fresh,
read only its own brief, built its slice, verified it, and reported a terminal
status — 23 completed outright, 7 were decomposing parents that suspended once
their children finished. **Zero failed.**

The final `integration` agent is a **verification gate**, not a coding step: it
runs the real toolchain against the assembled project and emits a single
GO / NO-GO verdict with cited evidence (see §4).

---

## 3. The output

A small, dynamically-typed language with a tree-walking interpreter in **strict
TypeScript** — lexical closures, first-class functions, arrays/objects, C-style
control flow, and first-class **source-anchored error diagnostics**. (See the
[README](README.md) for a language taste and the
[language reference](docs/LANGUAGE.md) / [grammar](docs/GRAMMAR.md) for the full spec.)

| | |
|---|---|
| Source files | **29** TypeScript modules (`src/{core,lexer,parser,runtime,stdlib,cli}`) |
| Tests | **27** files, **532** tests, all green |
| Coverage | **98.7 %** lines (v8), every `src/` subtree ≥ 96 % |
| Type safety | strict `tsc`, **zero `any`** in `src/` |
| Style | `eslint` + `prettier` clean |
| Runnable | `bin/klein.mjs` CLI + REPL, 10 example programs with golden outputs |

---

## 4. How to review this as AI-generated code

AI-generated code deserves *more* scrutiny than a human PR, not less — but it
also ships with something most PRs lack: a complete provenance trail. Here's how
to use it.

### 4.1 Start from the contract, not the code

Read [`taskflow/contracts/`](taskflow/contracts) first. It's the frozen spec
every component agreed on. If the seam is sound, each component either honors it
or it doesn't — and that's mechanically checkable, not a matter of taste.

### 4.2 Trace any file back through the audit trail

Every `taskflow/SUBTASK_*/` directory holds:

- **`_BRIEF.md`** — exactly what that agent was told to build (its slice, inputs,
  declared outputs, dependencies). *This is the spec the code should match.*
- **`COMPLETE.md` / `SYNTHESIS.md`** — what the agent reported producing and how
  it verified its own slice.

So for any file in `src/`, you can trace: *which task owned it → its brief → its
declared outputs → the synthesis that checked it.* Pick a file, read its owning
brief, and confirm the code does what the brief promised — no more, no less.

### 4.3 Re-run the verification yourself — don't trust the gate, reproduce it

The release gate claims 532 passing tests at 98.7 % coverage. **Verify it:**

```bash
npm ci
npm run typecheck        # strict tsc, expect 0 errors
npm run lint             # eslint, expect 0
npm run format:check     # prettier
npm test                 # vitest — expect 532 passing
npm run coverage         # expect ~98.7% lines
node bin/klein.mjs examples/fibonacci.kl   # run a real program
node bin/klein.mjs examples/fizzbuzz.kl
```

If those don't reproduce, the claims are false. (They do.)

### 4.4 Weigh the honesty of the self-report

A trustworthy signal in AI output is that it **flags what it could not fully
verify** instead of blanket-asserting success. Klein's integration gate reached
a **GO ✅** verdict on 9 checks, and recorded two of them as *qualified*:

- **`contract_immutable`** — git wasn't available in the build sandbox, so it
  fell back to file-timestamp evidence instead of a content hash, and *said so*.
- **`ownership_respected`** — it found the root manifest under-listed 3 scaffold
  files, and *reported it* rather than papering over it.

When reviewing AI code, an agent that says "I verified X by method Y, and here
is what I *couldn't* verify" is far more trustworthy than one that just says
"all good." Read `taskflow/SUBTASK_integration/SYNTHESIS.md` — the evidence
column is the review.

### 4.5 Spend human attention where it's worth most

- **Semantics** (`src/runtime/interpreter.ts`): does the language behave as the
  [spec](docs/LANGUAGE.md) documents — truthiness, scoping, closures, error paths?
  Read the tests against the spec.
- **Diagnostics** (`src/core/`, the stated selling point): are the errors
  actually good, and source-anchored?
- **Composition boundaries**: do the stages truly compose, or merely typecheck?
  The `tests/integration/**` golden tests exercise the whole pipeline — start
  there.
- **The coverage gaps**: whatever the report leaves uncovered is where behavior
  is unproven.

### 4.6 Generic AI-code red flags — and how Klein fares

| Red flag | What to check | Klein |
|---|---|---|
| "Draw the rest of the owl" (a step states a result but hides the work) | Read a brief, then its output — is the gap bridged by real code or hand-waving? | Decomposition explicitly guards against this; leaf tasks are small |
| Hallucinated / unused dependencies | `package.json` deps are real and imported | audited by the gate |
| Tests that assert nothing / test the mock | Read a sample of `*.test.ts` | 532 tests key off structured `ErrorCode`s, not message text |
| `any` / type escapes | grep `src/` for `any` | gate reports **zero** in `src/` |

---

## Provenance summary

- **Human input:** one paragraph (§1). No design decisions.
- **Machine:** 30 agent invocations, contract-first parallel decomposition, each
  slice self-verified, whole gated by a release-verdict agent.
- **Audit trail:** [`taskflow/`](taskflow) is the unedited build record
  (engine tokens + agent system prompts removed before publishing).
- **Reproducibility:** every claim in §3–§4 is re-runnable with the commands in
  §4.3.

*Built by the Nousix taskflow engine, running on Claude Opus.*
