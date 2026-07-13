# Task: Build tooling & config — the toolchain single source of truth

**Slug**: `tooling` · **Depends on**: none (Group 0 of the scaffold subtree) ·
**Dependents**: `core`, `docs`, `verify` — and, transitively, every later pipeline stage.

## Objective
Establish the production TypeScript/Node **build, lint, format, test, and CI**
configuration so that from this point any component compiles, lints, and tests in
isolation against ONE fixed, pinned toolchain that you own definitively.

## Context
Part of the Klein `scaffold` subtree (see `../_GLOBAL.md`) within project Klein
(see `../../_GLOBAL.md`). You are the precursor: nothing else in the project can
build until you exist. You fix the toolchain; `core`, `docs`, and all later stages
consume your choices, never substitutes.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree ownership split (§7), inherited constraints (§4),
  the path-alias decision (§8), subtree success criteria (§9).
- `../../_GLOBAL.md` — project quality bar (§1), cross-cutting conventions (§7).
- `../../contracts/` — **read-only**. Note `contracts/index.ts` and the `@contracts`
  alias expectation; your `tsconfig` must make that alias resolve. Do not edit anything here.

## Owned outputs (exclusive — write ONLY these; all at project root `../../`)
- `package.json` — exact pinned deps; scripts: `build`, `lint`, `format`,
  `format:check`, `test`, `coverage` (and any `test:watch` you want); `bin` entry
  for the eventual `klein` CLI; ESM (`"type": "module"`).
- `tsconfig.json` and `tsconfig.build.json` — strict, `NodeNext`, `@contracts` and
  `@core` path aliases matching `../../_GLOBAL.md` §5 and `../_GLOBAL.md` §8.
- `eslint.config.js` (flat config, typescript-eslint), `.prettierrc.json`.
- `vitest.config.ts` — coverage provider + thresholds ≥90%.
- `.gitignore`, `.npmignore`, `.github/workflows/ci.yml` (install → build → lint →
  format:check → test).

Write NOTHING under `src/`, `docs/`, `tests/`, and do not create
`README`/`LICENSE`/`CHANGELOG` — those belong to `core` and `docs`. Do not modify `contracts/`.

## Success criteria
- `npm install` resolves with exact, mutually-compatible pinned versions.
- `npm run build` succeeds even though only `contracts/` (and later `src/core/`)
  exist — configure `tsc` so an otherwise-empty `src/` builds clean (e.g. no
  "no inputs" error). Prove it (a trivial throwaway you then remove, or an include
  strategy that tolerates an empty `src/`).
- `npm run lint` and `npm run format:check` run green against the repo as it stands.
- The `@contracts` (and `@core`) alias resolves at **compile time and at runtime**
  (Vitest + the `bin` you declare). If you cannot prove robust runtime alias
  resolution, fall back to a consistent relative-import convention and **document
  the decision explicitly in `COMPLETE.md`** so `core` and later stages follow it.
- CI workflow is valid YAML and mirrors the local gate.

## Constraints
- Pin **exact, current, mutually-compatible** versions — you are the single source
  of truth; record the chosen versions and any compatibility notes in `COMPLETE.md`.
- Node ≥ 18, ESM `NodeNext`. Strict TS. Do not weaken strictness to make things pass.

## Notes
Keep the config boring and conventional (the persona's posture: the boring choice
is the courageous one). Re-run your own atomic-vs-decompose check at dispatch;
this is a single cohesive responsibility (toolchain config) and is expected to be
Atomic, but that judgement is yours.
