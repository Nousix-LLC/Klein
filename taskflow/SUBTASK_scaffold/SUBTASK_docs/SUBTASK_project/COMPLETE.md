# COMPLETE — `SUBTASK_project` (onboarding & meta docs)

**Task**: Author Klein's project-facing onboarding and meta documentation.
**Decompose evaluation**: `Atomic` (one cohesive responsibility: the project's
front-door/meta docs). **Status**: completed.

## Owned outputs authored (all at project root `../../../`)

- `README.md` — what Klein is; a `.kl` language taste (closures, arrays,
  objects, control flow, truthiness/short-circuit demo); requirements; intended
  run UX + current developer flow; diagnostics feature; the npm-scripts table
  (verbatim from `package.json`); project layout; contributing notes; intentional
  non-goals; license reference. Links to `docs/LANGUAGE.md` and
  `docs/GRAMMAR.md` (does not re-specify them).
- `LICENSE` — standard MIT text, `Copyright (c) 2026 The Klein Project`.
- `CHANGELOG.md` — Keep a Changelog 1.1.0 style with `Unreleased` and a
  `0.1.0 - 2026-07-13` entry describing first-release scope.

Nothing else was written. No `src/`, `tests/`, tooling config, `docs/*.md`, or
`contracts/` were created or modified (verified: `contracts/` untouched).

## Ground-truth fidelity (zero drift)

- Scripts, package name (`klein`), `bin.klein` (`bin/klein.mjs`),
  `engines.node` (`>=18.18.0`), `"type": "module"`, and MIT license are quoted
  **verbatim** from `package.json` (docs hub §5).
- Language claims (values, operators, control flow, truthiness = only
  `null`/`false` falsy, structural-vs-reference equality, comment/literal forms)
  mirror project hub §3 and docs hub §4 exactly; the README defers detail to
  `docs/LANGUAGE.md`.
- The diagnostics example uses a real `ErrorCode` (`E3001 UndefinedVariable`)
  and the exact snippet+caret render form from `contracts/errors.ts`; the phase
  code ranges (`E1xxx`/`E2xxx`/`E3xxx`) match that enum.
- Out-of-scope features (project hub §2 / docs hub §4) are presented as
  **intentional** design decisions, not omissions.

## Formatting

Ran the project's Prettier over the deliverables and verified the real gate:
`prettier --check .` reports **"All matched files use Prettier code style!"**
(exit 0). `LICENSE` has no Prettier parser, so `--check .` skips it (expected);
it is valid MIT regardless. `.prettierignore` does not exclude `README.md` /
`CHANGELOG.md`, so both are covered by the gate and pass.

## Deferrals flagged (not confabulated), per the brief

1. **Published-CLI invocation.** `bin/klein.mjs` and `src/cli/` are owned by the
   later `cli` task and do not exist yet, so no working `klein <file>` command
   could be proven. The README presents the intended UX (`klein path/to/file.kl`,
   `klein` for the REPL) explicitly labeled as the target interface, gives the
   current developer flow via the npm scripts, and adds a note deferring the exact
   run mechanism and npm-install/publish specifics to the CLI/publish stage
   (docs hub §5). No install-from-npm mechanism was asserted.
2. **Repository URL.** `package.json` declares no `repository`, so no repo URL
   was invented — Keep-a-Changelog comparison-link footers were omitted rather
   than pointed at a guessed URL (bracketed version headings still render fine).
3. **Stdlib builtin names.** The stdlib surface is not fixed in the contracts
   read; the README avoids pinning specific builtin names (the `.kl` taste uses
   only language constructs with `// => value` result annotations) and defers the
   builtin list to `docs/LANGUAGE.md`.

## Environment note (methodology gap)

The software methodology bundle was unavailable this invocation
(`methodology_glob`/`load_methodology` returned `agent_domain_unset`,
deterministically; no domain-bind syscall is exposed). This matches the
project-hub §8 known gap. Work proceeded from the briefs + hub + `contracts/`
as the encoded methodology, per the kernel's "document the gap rather than
confabulate" guidance. Nothing authored contradicts standard technical-doc or
interpreter conventions.

## Handoff to `SUBTASK_synthesis`

`synthesis` (depends on language, grammar, project) can verify cross-document
consistency and re-run `format:check`. The README's forward links to
`docs/LANGUAGE.md` and `docs/GRAMMAR.md` are intentional and become live once
the `language`/`grammar` siblings land those files.
