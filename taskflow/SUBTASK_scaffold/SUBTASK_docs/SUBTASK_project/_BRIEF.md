# Task: Project onboarding & meta docs (`README.md`, `LICENSE`, `CHANGELOG.md`)

**Slug**: `project` · **Depends on**: — · **Dependents**: `synthesis`.

## Objective
Author Klein's project-facing onboarding and meta documentation: what Klein is, how
to install and run it, the npm scripts, contributing notes, the MIT license, and the
initial changelog.

## Context
Part of the Klein `docs` subtree (see `../_GLOBAL.md`). These three files form one
cohesive concern: orienting a new user/contributor to the project and its
process/legal metadata. README summarizes the language and **links** to the
authoritative `docs/LANGUAGE.md` and `docs/GRAMMAR.md` (it does not re-specify
them). Install/usage MUST match the real toolchain, not a guess.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree ground truth: §5 (exact toolchain facts: package name,
  `bin`, scripts, Node engine, how the CLI is run) and §6 (formatting).
- `../../../_GLOBAL.md` — §1 quality bar, §2 scope (in/out incl. intentional debt),
  §3 language summary to condense for the README overview.
- `../../../package.json` — the real package name, `version`, `bin`, `engines`, and
  `scripts` so README commands are exact.
- `../../../contracts/` — read-only; consult only to keep the README's high-level
  language blurb accurate (do not deep-dive; that is `language`'s job).

## Owned outputs (exclusive — write ONLY these; all at project root `../../../`)
- `README.md` — what Klein is; a short language taste (with a `.kl` snippet);
  install; quickstart (running a `.kl` file and the REPL); the npm scripts table
  (verbatim from `package.json`); links to `docs/LANGUAGE.md` and `docs/GRAMMAR.md`;
  contributing notes (strict TS, lint/format/test gate, tests key off `ErrorCode`);
  a brief "intentional non-goals" section (project hub §2); license reference.
- `LICENSE` — MIT (standard text; copyright holder line for the Klein project, year
  2026).
- `CHANGELOG.md` — Keep-a-Changelog style with an initial `Unreleased` and `0.1.0`
  entry describing the first release scope.

Write NOTHING else — not `docs/LANGUAGE.md`, `docs/GRAMMAR.md`, `src/`, `tests/`,
tooling config, or `contracts/`.

## Success criteria
- Every command/script/name in README matches `package.json` exactly (scripts,
  `bin.klein`, package name `klein`, `engines.node >=18.18.0`). Do not invent a
  run/install mechanism the scaffold hasn't proven — follow `../_GLOBAL.md` §5, and
  flag any deferral (e.g. npm publish specifics owned by `cli`) rather than guess.
- README's language blurb is consistent with hub §3 and does not contradict
  `docs/LANGUAGE.md` (link to it for detail; keep truthiness/equality claims correct).
- Out-of-scope features are presented as **intentional** non-goals, not omissions.
- `LICENSE` is valid MIT; `CHANGELOG.md` follows Keep-a-Changelog structure.
- Authored to pass `npm run format:check` (Prettier applies to `README.md`,
  `CHANGELOG.md`, and `LICENSE`; see `../_GLOBAL.md` §6).

## Constraints
- Documentation only — no runtime behavior, no invented semantics. If a genuine gap
  exists (e.g. the exact published-CLI invocation), document the current developer
  flow and flag the deferral in your `COMPLETE.md` rather than confabulate.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. README + LICENSE +
CHANGELOG are one onboarding-docs responsibility (LICENSE/CHANGELOG are largely
boilerplate); expected atomic, but the judgement is yours.
