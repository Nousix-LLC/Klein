# Task: Scaffold synthesis — prove tooling + core + docs compose

**Slug**: `verify` · **Depends on**: `tooling`, `core`, `docs` ·
**Dependents**: none within the subtree (this is the scaffold synthesis hub).

## Objective
Prove that the three scaffold concerns compose into a clean, buildable skeleton:
run the full quality gate end-to-end, assert the ownership/contract invariants, and
write the scaffold-level synthesis record that the parent `SUBTASK_scaffold` hands
upward to `lexer` and beyond.

## Context
Part of the Klein `scaffold` subtree (see `../_GLOBAL.md`). Your siblings have
completed: `tooling` (config), `core` (`src/core/**`, `tests/core/**`), `docs`
(README/spec/grammar/license/changelog). You wire nothing new of substance — you
are the "does it all actually build together" step, mirroring the project-level
`integration` synthesis role at scaffold scope. Fail loudly on any miss; do not
paper over gaps with silent plugs.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree success criteria (§9), ownership split (§7), path-alias
  decision (§8).
- `../../_GLOBAL.md` — project success criteria (§9), identities.
- `../../contracts/_MANIFEST.yaml` — the `identities` block; you assert the subset
  in scope now (`compiles`, `lints_clean`, `formatted`, `tests_pass`, `coverage`
  for `src/core`, `contract_immutable`, `ownership_respected`, `no_any_leak`).
- Sibling dependency outputs: `../SUBTASK_tooling/COMPLETE.md`,
  `../SUBTASK_core/COMPLETE.md`, `../SUBTASK_docs/COMPLETE.md`, plus the actual
  project tree they produced under `../../`.

## Process (verification — run the real commands; report evidence)
Run the toolchain gate and record actual results (not assumptions):
`npm install`, `npm run build` (with only `src/core/` present, must be clean),
`npm run lint`, `npm run format:check`, `vitest run` with coverage for `src/core/`.
Then assert the structural invariants:
- **Contract immutability** — `contracts/` unchanged since root authorship.
- **Ownership respected** — every written path falls inside exactly one child's
  declared ownership subtree; no overlaps, no strays outside the scaffold set.
- **Path aliases / import convention** — resolve at compile AND runtime, per the
  decision recorded by `tooling` (or its documented relative-import fallback).
- **Diagnostic renderer** — sample output matches the `contracts/errors.ts` layout.
- **Docs consistency** — README commands match `package.json`; spec/grammar match
  `contracts/` vocabulary (spot-check token names, `ErrorCode`s, operator set).

## Owned outputs (exclusive)
- `SYNTHESIS.md` (in this task's workspace) — the scaffold synthesis/completion
  record: what the subtree delivered, the pass/fail of each identity above with
  evidence, the import-convention decision downstream stages must follow, and any
  residual gaps or intentional debt handed forward.
- A supporting verification report (e.g. `verification-report.md`) in this
  workspace if useful.

Write NO project source/config/doc file (`tooling`/`core`/`docs` own those). If you
find a defect, DO NOT fix it here — report it in `SYNTHESIS.md`; remediation is a
separate task the parent/session decides on. Do not modify `contracts/`.

## Success criteria
- Every in-scope `_MANIFEST.yaml` identity is asserted with concrete evidence
  (command + observed result), each marked pass/fail.
- `SYNTHESIS.md` states unambiguously whether the scaffold subtree meets
  `../_GLOBAL.md` §9, and records the downstream-binding import convention.
- Any failure is reported loudly and specifically (which identity, what was
  observed) rather than smoothed over.

## Constraints
- Read-many, write-only-your-own-workspace. You are a verifier/synthesizer, not an
  implementer.
- Re-run your own atomic-vs-decompose evaluation at dispatch; this is expected to be
  a single synthesis responsibility (Atomic), but that judgement is yours.
