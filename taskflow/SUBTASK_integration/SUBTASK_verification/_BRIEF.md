# Task: Mechanical integrity verification + SYNTHESIS.md (the synthesis hub record)

**Slug**: `SUBTASK_verification` · **Depends on**: `SUBTASK_e2e_tests` · **Dependents**: none.

## Objective
Run every integration identity declared in `../../contracts/_MANIFEST.yaml` across the
whole composed repository, and author `SYNTHESIS.md` — the self-contained,
downstream-facing account of the delivered Klein interpreter and its verification
status, with a clear GO / NO-GO verdict. Report every failure precisely (naming the
responsible upstream task); **never silently patch a failing identity.**

## Single responsibility
Verify + synthesize. You produce exactly one durable artifact — `SYNTHESIS.md` — and
run read-only checks. You write NO source, test, example, or contract files.

## Inputs (read at start)
- `../_GLOBAL.md` (subtree hub) and `../../_GLOBAL.md` (project hub — §9 project-level
  success criteria).
- `../../contracts/_MANIFEST.yaml` — the `identities:` and `ownership:` clauses you
  assert verbatim.
- The whole repository (`../../src/**`, `../../tests/**`, `../../examples/**`,
  `../../bin/**`, `../../docs/**`, config files) and the completion records of the
  sibling/upstream tasks.

## Approach (each identity → a concrete command + a recorded verdict)
Run from the project root `../../`. Map each `_MANIFEST.yaml` identity to evidence:

- **compiles** — `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) **and**
  `npm run build` (`tsc -p tsconfig.build.json`): zero errors.
- **lints_clean** — `npm run lint` (`eslint .`): zero errors.
- **formatted** — `npm run format:check` (`prettier --check .`): passes.
- **tests_pass** — `npm test` (`vitest run`): every stage suite **plus** the new
  `tests/integration/**` and `tests/errors/**` green.
- **coverage** — `npm run coverage` (`vitest run --coverage`): read the tool-reported
  line coverage for `src/` and assert **≥ 90%**. Report the actual number; this is a
  tool-reported value — do not hand-compute it.
- **contract_immutable** — assert nothing under `../../contracts/` changed since root
  authorship. Prefer `git -C ../../ status --porcelain contracts/` and
  `git -C ../../ diff -- contracts/`; if git has no baseline/ is unavailable, say so
  precisely and state the fallback you used — do **not** claim a pass you did not verify.
- **ownership_respected** — using the `ownership:` map, confirm every source/test/
  config artifact lives under exactly one task's declared subtree and no task wrote
  outside its set. Kernel scaffolding (`SUBTASK_*/`, `_GLOBAL.md`, `_BRIEF.md`,
  `SUSPENSION.md`, `SYNTHESIS.md`, `COMPLETE.md`) is named-state, not project source —
  exclude it from this audit.
- **examples_run** — every `examples/*.kl` runs via the CLI and matches its golden
  `.out` (the `tests/integration` suite already asserts this; you confirm it ran and,
  for a spot check, run one or two through `node bin/klein.mjs` directly).
- **no_any_leak** — no `any` in public exports; `tsc` strict enforced (strict-mode
  `compiles` pass is the primary evidence; a targeted check of the public surface in
  `src/index.ts` corroborates).

For each identity record: command run, pass/fail, and the salient evidence (error
count, coverage %, failing test names). If an identity fails because an **upstream
task's output is inadequate**, NAME that task and request an additive plan amendment /
report the inadequacy — you own only `SYNTHESIS.md` and MUST NOT edit `src/`, `tests/`,
`examples/`, or `contracts/` to make a check pass.

Then author **`SYNTHESIS.md`** at the integration workspace root
(`SUBTASK_integration/SYNTHESIS.md`) — the synthesis-hub completion record. It must give
a fresh, stateless downstream reader a complete picture: what Klein is and its
language/architecture in brief; how the stages compose against `contracts/`; a table of
every identity with its verdict and evidence (coverage numbers included); known gaps and
intentional debt (from `../../_GLOBAL.md §2`); and a final **GO / NO-GO**. When authoring
factual/quantitative claims, load and apply the kernel's Claim Verification Guide
(`modules/quality_assurance/CLAIM_VERIFICATION_GUIDE.md`) and Handoff Authoring Guide
(`modules/handoff/HANDOFF_AUTHORING_GUIDE.md`).

## Owned outputs
`SYNTHESIS.md` (at `SUBTASK_integration/SYNTHESIS.md`) — which is both the required
integration deliverable and your terminal `artifact_path`.

## Success criteria
- Every `_MANIFEST.yaml` identity is executed and its verdict recorded with evidence.
- All identities pass → `SYNTHESIS.md` records an honest **GO**; any failure → a
  precise **NO-GO** naming the responsible task and the failing evidence (no silent
  fixes, no plausible-but-unverified claims).
- `SYNTHESIS.md` is self-contained and accurate enough that a downstream reader needs
  no other file to understand the delivered interpreter and its status.

## Constraints
- Read-only everywhere except `SYNTHESIS.md`. Do not modify `contracts/` or any task's
  owned subtree; you compose and certify, you do not implement or patch.
- Terminal status: report `completed` when the verification ran and `SYNTHESIS.md`
  faithfully records the results (a documented NO-GO is a legitimate *completed*
  outcome — the honest verdict IS the deliverable). Report `failed` only if the
  environment prevented verification itself (e.g. toolchain unusable) such that no
  trustworthy verdict could be produced.
- Re-run your own atomic-vs-decompose evaluation at dispatch; expected atomic (one kind
  of output — the verification synthesis).
