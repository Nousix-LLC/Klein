# Task: `docs` subtree synthesis & cross-document consistency verification

**Slug**: `synthesis` · **Depends on**: `language`, `grammar`, `project`.

## Objective
Verify the three documentation outputs are mutually consistent and consistent with
`contracts/` + project hub §3, confirm the Markdown passes the formatter, and write
the `docs` subtree's synthesis record. This is the hub-and-spoke closer.

## Context
Part of the Klein `docs` subtree (see `../_GLOBAL.md`). You wire nothing new of
substance; you PROVE the doc set composes — no silent plugs. You are the subtree's
integrity gate before it reports up to the scaffold-level `verify` task.

## Inputs (read at start)
- `../_GLOBAL.md` — the subtree ground truth (§4 anti-drift list), toolchain facts
  (§5), formatting rules (§6), and success criteria (§9) you assert against.
- The three completed dependency outputs at project root:
  - `../../../docs/LANGUAGE.md` (from `language`)
  - `../../../docs/GRAMMAR.md` (from `grammar`)
  - `../../../README.md`, `../../../LICENSE`, `../../../CHANGELOG.md` (from `project`)
- `../../../contracts/` and `../../../_GLOBAL.md` §3 — the ground truth to check
  the docs against.
- `../../../package.json` — to confirm README's commands/names are exact.

## Process (approach, not a rigid runbook)
Check the `../_GLOBAL.md` §9 criteria mechanically where possible: cross-reference
token/keyword names, the full `ErrorCode` set, the operator set + precedence table,
truthiness rule, equality rule, and literal forms across LANGUAGE ↔ GRAMMAR ↔ README
↔ contracts; confirm every `contracts/ast.ts` node maps to a GRAMMAR production and
vice-versa (no orphans/gaps); confirm README commands match `package.json`; confirm
out-of-scope features are documented as intentional. Run `npm run format:check` (and
`npm run lint` if relevant) and record the result. Report any drift or gap
explicitly — do not fix sibling outputs silently (that would violate ownership); if
a real inconsistency exists, document it and, if it needs a fix, request a plan
amendment rather than editing another task's file.

## Owned output (exclusive — write ONLY this)
- `SYNTHESIS.md` **in this task's own workspace** — the consistency verdict against
  each `../_GLOBAL.md` §9 criterion (pass/fail + evidence), the `format:check`
  result, any drift/gaps found, and a clear overall PASS/FAIL for the `docs` subtree.

Write NO project file (no `README.md`, `docs/*`, `LICENSE`, `CHANGELOG.md`, `src/`,
`tests/`, `contracts/`) — verification only.

## Success criteria
- Every `../_GLOBAL.md` §9 criterion is checked and its verdict evidenced in
  `SYNTHESIS.md`.
- Cross-document drift (names/codes/operators/precedence/truthiness/equality/
  literals) is either shown absent or reported explicitly with location.
- `docs/GRAMMAR.md` ↔ `contracts/ast.ts` coverage is asserted (no orphan
  productions, no missing constructs).
- `npm run format:check` result on the delivered docs is recorded.
- A single unambiguous subtree PASS/FAIL is stated.

## Constraints
- Verification/synthesis only. Do not modify sibling outputs or `contracts/`. A
  found defect is reported (and, if fixable, routed via plan amendment), never
  silently patched.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. This is one synthesis
responsibility over three finished inputs; expected atomic.
