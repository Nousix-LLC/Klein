# Task: Integration — examples, end-to-end tests, and mechanical integrity verification

**Slug**: `integration` · **Depends on**: `cli` · **Dependents**: none (synthesis hub)

## Objective
Prove the whole interpreter composes and meets the production bar: author real
Klein example programs with golden outputs, end-to-end tests through the CLI, and
run the contract's mechanical integrity identities — failing loudly on any miss.

## Context
Part of **Klein** (see `../_GLOBAL.md` §6). You are the synthesis task. Every
stage is complete and real. Your job is verification and demonstration, not new
core functionality.

## Inputs (read at start)
- `../_GLOBAL.md`, `../contracts/_MANIFEST.yaml` (the identities you assert), all of `../src/**`, `../bin/**`, `../docs/**`.

## Approach (single responsibility: integration & verification)
1. **Examples** — `examples/*.kl`: a curated set exercising the language end-to-end
   — e.g. `fibonacci.kl`, `fizzbuzz.kl`, `closures.kl` (counter/adder), `higher_order.kl`
   (map/filter/reduce), `data_structures.kl` (arrays+objects), `errors.kl`
   (intentional faults for diagnostic demos). Each with a committed golden output.
2. **E2E tests** — `tests/integration/**`: run every example through the real CLI/
   `interpret()` and assert stdout matches its golden file; `tests/errors/**`:
   assert each error example yields the expected `ErrorCode`(s) and a rendered
   snippet+caret diagnostic.
3. **Mechanical integrity** — assert the `_MANIFEST.yaml` identities:
   `tsc --noEmit` clean, `eslint .` clean, `prettier --check` clean, `vitest run`
   green, coverage ≥90% on src/, `contracts/` unmodified, ownership subtrees
   respected (no task wrote outside its set), every example matches its golden.
   Report failures as structured signals; do NOT silently patch a failing identity —
   if something doesn't compose, request a plan amendment / report which upstream
   task's output is inadequate.

## Owned outputs
`examples/**`, `tests/integration/**`, `tests/errors/**`, and your completion
record (`SYNTHESIS.md`) summarizing the identity results and how the pieces compose.

## Success criteria
- Every example runs and matches its golden output via the CLI.
- All integrity identities pass (or are reported precisely as failures with the
  responsible task named). Full `npm test` + build + lint + format green.
- `SYNTHESIS.md` gives a downstream reader a complete, self-contained picture of
  the delivered interpreter and its verification status.

## Constraints
- Do not modify `contracts/` or any other task's owned subtree; you compose and verify.
- Prefer driving the real `bin`/`interpret()` over re-implementing pipeline glue.
