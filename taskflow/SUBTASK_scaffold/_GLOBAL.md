# Klein — `scaffold` subtree hub (`_GLOBAL.md`)

**Subtree hub.** Shared, write-once context for every task in the `scaffold`
decomposition. Each child reads this file, its own `SUBTASK_*/_BRIEF.md`, the
grandparent `../../_GLOBAL.md` (project hub), and treats `../../contracts/` as
**read-only** ground truth.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Parent**: `SUBTASK_scaffold`
(see `../_BRIEF.md`).

---

## 1. Why this subtree exists

`SUBTASK_scaffold` is the Group-0 precursor of the Klein interpreter: nothing in
the project compiles, lints, or tests until it exists. Its brief spans **three
distinct concerns** — build tooling/config, the shared runtime core (`src/core/`),
and documentation — plus a fourth, implicit concern: proving the three *compose*
(the parent's own success criteria: `npm install && npm run build` clean, lint /
format / `tests/core/` green, path aliases resolve at compile **and** runtime).

Applying the kernel decomposition triggers (Scope / Distinct-Concerns fire by
enumeration; Single-Responsibility fires on "configure AND implement AND
document"; Output-Size ≫400 lines across ~19 files), `scaffold` decomposes rather
than executing as one invocation. This hub records that split and the contract
each child inherits.

## 2. Objective (subtree)

Stand up the production TypeScript/Node skeleton and the shared `src/core/`
runtime core so that, from here on, **any** later stage (lexer → … → integration)
can compile, lint, and test in isolation against a fixed toolchain and a shared
error/diagnostic core that implements `contracts/errors.ts`.

## 3. Scope

**In scope (this subtree):** toolchain + config, `src/core/**` + `tests/core/**`,
all scaffold-owned docs, and end-to-end verification that they build together.

**Out of scope:** any pipeline stage source (`src/lexer`, `src/parser`,
`src/runtime`, `src/stdlib`, `src/cli`, `src/index.ts`), examples, and integration
tests — those are owned by sibling `SUBTASK_*` tasks of the *parent* DAG, not here.
Do not create them. Do not edit `contracts/`.

## 4. Inherited constraints (binding on every child — from `../../_GLOBAL.md` §7)

- **TypeScript strict**; ESM `NodeNext`; **Node ≥ 18**. Test runner **Vitest**;
  lint **ESLint** (typescript-eslint) + **Prettier**.
- **No `any`** in exported/public surface; prefer discriminated unions + exhaustive
  `switch` with a `never` default arm.
- **Errors always carry a `Span`.** The concrete error classes implement
  `contracts/errors.ts#KleinError` and extend native `Error`.
- **Tests key off `ErrorCode`**, never on human-readable message text.
- One responsibility per module; each subtree exposes a barrel `index.ts`.
- **Exact, pinned, mutually-compatible dependency versions.** `tooling` is the
  single source of truth for the toolchain; `core`, `docs`, and every later stage
  use its choices, not substitutes.

## 5. Methodology posture (inherited)

The engine's software methodology bundle was unavailable (`agent_domain_unset`;
see `../../_GLOBAL.md` §8). Methodology is therefore encoded in `contracts/`, the
project hub, and these briefs. A child dispatched with the bundle available
SHOULD load it and reconcile; nothing here should contradict standard,
well-trodden TypeScript-tooling / interpreter-core practice. When a step is
underspecified, prefer the boring, conventional choice and **document it** rather
than confabulate.

## 6. Task structure & dependency DAG

Precursor → parallel build → synthesis. `tooling` is the precursor (it fixes the
toolchain, path-alias strategy, and pinned versions everything else consumes);
`core` and `docs` build in parallel on top of it; `verify` is the synthesis hub
that proves the three compose and writes the scaffold-level record.

| Task (slug) | Responsibility (one kind of change) | Depends on | Key owned outputs |
|---|---|---|---|
| `SUBTASK_tooling` | Build tooling & config; the toolchain single-source-of-truth | — | `package.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `.gitignore`, `.npmignore`, `.github/workflows/ci.yml` |
| `SUBTASK_core` | Shared runtime core `src/core/` + its unit tests | tooling | `src/core/**`, `tests/core/**` |
| `SUBTASK_docs` | Project & language documentation | tooling | `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/LANGUAGE.md`, `docs/GRAMMAR.md` |
| `SUBTASK_verify` | Synthesis: prove tooling+core+docs compose end-to-end | tooling, core, docs | `SYNTHESIS.md` (+ a verification report in its own workspace) |

```
tooling ─┬─▶ core ──┐
         └─▶ docs ──┴─▶ verify
```

Each child re-runs its OWN atomic-vs-decompose evaluation at dispatch. `core` in
particular MAY legitimately decompose further (span helpers / error classes /
diagnostic renderer are distinct modules); that decision is the child's, not this
hub's.

## 7. Ownership split (subdivides `contracts/_MANIFEST.yaml` → ownership.scaffold; no overlap)

The manifest assigns the full config/doc/`src/core` set to `scaffold` collectively.
This subtree partitions it disjointly:

- **tooling** → the nine config/CI files above. Nothing under `src/`, `docs/`, no `README`/`LICENSE`/`CHANGELOG`.
- **core** → `src/core/**` and `tests/core/**` only.
- **docs** → `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/LANGUAGE.md`, `docs/GRAMMAR.md` only.
- **verify** → writes NO project file; only its own workspace artifacts (`SYNTHESIS.md`, report).

No two children write the same path. No child writes outside the scaffold
ownership set. `contracts/` is read-only for all.

## 8. Path-alias decision (fixed here so children agree)

`contracts/` already expects a `@contracts` alias (`contracts/index.ts`,
`tokens.ts` docstrings) and the parent hub §5 references it; components will
`import { Token } from "@contracts"`. `tooling` MUST wire the `@contracts` and
`@core` path aliases in `tsconfig.json` AND make them resolve at **runtime**
(Vitest + the eventual `bin`) — not only at compile time. If a robust runtime
alias resolution cannot be proven, `tooling` MUST fall back to consistent relative
imports and document the choice in its completion record; `core` then follows the
same convention. Whatever `tooling` proves working, `core`, `docs`, `verify`, and
all later stages use.

## 9. Subtree success criteria (verified by `SUBTASK_verify`)

- [ ] `npm install && npm run build` succeeds with only `src/core/` present (an
      otherwise-empty `src/` builds clean).
- [ ] `npm run lint`, `npm run format:check`, and the `tests/core/` suite pass.
- [ ] Coverage thresholds (≥90%) are configured and met for the delivered core.
- [ ] The diagnostic renderer emits the snippet+caret format shown in
      `contracts/errors.ts`.
- [ ] Path aliases (or the documented relative-import fallback) resolve at compile
      time AND runtime, proven end-to-end.
- [ ] `contracts/` unmodified; no task wrote outside its ownership subtree.
- [ ] `README.md`, `docs/LANGUAGE.md`, `docs/GRAMMAR.md` complete and consistent
      with `../../_GLOBAL.md` §3 and `contracts/`.
