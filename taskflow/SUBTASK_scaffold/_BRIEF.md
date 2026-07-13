# Task: Project scaffolding, tooling, docs, and shared core

**Slug**: `scaffold` · **Depends on**: none (Group 0) · **Dependents**: all other tasks

## Objective
Stand up the production TypeScript/Node project skeleton and the shared runtime
core (`src/core/`) that every other stage imports, so that from this point on any
component can compile, lint, and test in isolation.

## Context
Part of **Klein** (see `../_GLOBAL.md`). You are the precursor: nothing compiles
until you exist. Treat `../contracts/` as read-only ground truth — your
`src/core/errors.ts` must `implements` the interfaces in `contracts/errors.ts`.

## Inputs (read at start)
- `../_GLOBAL.md` — objectives, conventions (§7), quality bar.
- `../contracts/` — especially `errors.ts` (you implement it), `tokens.ts` (Span/Position).

## This task spans three distinct concerns (evaluate your own atomicity accordingly)
1. **Build tooling & config** — `package.json` (deps, scripts: build/lint/format/test/coverage; `bin`; ESM `type: module`), `tsconfig.json` + `tsconfig.build.json` (strict, `NodeNext`, `@contracts`/`@core` path aliases matching §5), `eslint.config.js` (typescript-eslint), `.prettierrc.json`, `vitest.config.ts` (coverage thresholds ≥90%), `.gitignore`, `.npmignore`, `.github/workflows/ci.yml` (install → build → lint → format:check → test).
2. **Shared runtime core** — `src/core/span.ts` (Span/Position construction + merge helpers), `src/core/errors.ts` (concrete `LexicalError`/`SyntaxErr`/`RuntimeErr` classes extending `Error` and implementing `contracts/errors.ts#KleinError`, carrying `code`, `span`, optional stack), `src/core/diagnostic.ts` (the `DiagnosticFormatter` — snippet + caret rendering, optional ANSI color), `src/core/index.ts` barrel. Unit-test the formatter and error classes under `tests/core/`.
3. **Documentation** — `README.md` (what Klein is, install, quickstart, CLI usage, contributing), `docs/LANGUAGE.md` (the full authoritative language spec expanding `_GLOBAL.md` §3), `docs/GRAMMAR.md` (EBNF grammar), `LICENSE` (MIT), `CHANGELOG.md`.

Decide for yourself whether these three warrant sub-decomposition; name them here
so your Scope/Distinct-Concerns evaluation is honest.

## Owned outputs (per `../contracts/_MANIFEST.yaml` → ownership.scaffold)
Config/doc files listed there, plus `src/core/**` and `tests/core/**`. Write
NOTHING outside this ownership set. Do not modify `contracts/`.

## Success criteria
- `npm install && npm run build` succeeds (even though only `src/core/` exists yet — configure `tsc` so an otherwise-empty `src/` builds clean).
- `npm run lint`, `npm run format:check`, and `tests/core/` pass.
- The diagnostic renderer produces the snippet+caret format shown in `contracts/errors.ts`.
- Path aliases resolve at compile time AND at runtime (Vitest + the eventual `bin`), or use relative imports consistently — whichever you can prove works end-to-end; document the choice.

## Constraints
- Pin exact, current, mutually-compatible versions; you are the single source of
  truth for the toolchain — later tasks use your choices, not substitutes.
- Node ≥ 18, ESM. No `any` in `src/core` public surface.
