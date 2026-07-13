# COMPLETE — `SUBTASK_tooling` (Klein toolchain single source of truth)

**Task**: Establish the production TypeScript/Node build, lint, format, test, and
CI configuration for Klein. **Decompose evaluation**: Atomic (one cohesive
responsibility — toolchain configuration). **Status**: COMPLETED.

Every choice below was **proven by running the real command**, not asserted. This
file is binding on `core`, `docs`, `verify`, and every downstream pipeline stage:
where it records a convention (import style, runtime, versions), follow it — do
not substitute.

---

## 1. What was delivered (owned outputs, all at project root `../../../`)

| File | Role |
|---|---|
| `package.json` | ESM package, exact pinned devDeps, scripts, `bin`, `engines` |
| `package-lock.json` | Reproducible install for `npm ci` (committed on purpose) |
| `tsconfig.json` | Base strict config (editor, typecheck, lint, tests) |
| `tsconfig.build.json` | Production strict type-check gate (`npm run build`) |
| `eslint.config.js` | Flat ESLint 9 + typescript-eslint 8, type-aware |
| `.prettierrc.json` | Prettier 3 style |
| `.prettierignore` | Scope Prettier to authored package source |
| `vitest.config.ts` | Vitest 3 + v8 coverage (≥90% thresholds) + runtime aliases |
| `.gitignore`, `.npmignore` | VCS / publish hygiene |
| `.github/workflows/ci.yml` | CI mirroring the local gate on Node 18/20/22 |

Nothing was written under `src/`, `tests/`, `docs/`; no `README`/`LICENSE`/
`CHANGELOG`; `contracts/` is unmodified (verified — byte sizes unchanged).

## 2. Proof the gate is green (commands actually run on Node v24.18.0)

With an **empty `src/` and no `tests/`** (the real handoff state):

```
npm run build        -> exit 0   (tsc -p tsconfig.build.json, strict)
npm run typecheck    -> exit 0
npm run lint         -> exit 0   (eslint .)
npm run format:check -> exit 0   (prettier --check .)
npm test             -> exit 0   (vitest run, passWithNoTests)
npm run coverage     -> exit 0
```

Runtime path-alias resolution proven with throwaway probes (since removed):
- **Vitest** imported `@contracts` (whose barrel re-exports extensionlessly) and
  passed 2/2 assertions — runtime alias + extensionless resolution works.
- **tsx** ran a `@contracts`-consuming script: `tsx runtime OK: EOF=EOF code=E1001`
  — the same resolution the eventual `klein` bin relies on.
- Coverage thresholds were proven to **actually bite** (a deliberately-uncovered
  probe made `npm run coverage` fail at 76.9% < 90%), so the ≥90% gate is real.

## 3. Pinned versions and the compatibility reasoning (READ THIS before bumping)

Exact, mutually-compatible pins (no `^`/`~` — this task is the single source of
truth):

| Package | Version | Why this and not "latest" |
|---|---|---|
| `typescript` | **5.9.3** | **NOT 7.x.** `typescript-eslint@8` peer-requires `typescript >=4.8.4 <6.1.0`; the current `typescript@7` (native port) breaks type-aware linting. 5.9.3 is the newest compatible. |
| `typescript-eslint` | 8.63.0 | Unified flat-config package; peers: eslint 8.57/9/10, TS <6.1. |
| `eslint` | **9.39.5** | **NOT 10.x.** ESLint 10 requires Node ≥20; the brief mandates **Node ≥18**. 9.x is the newest major still supporting Node ^18.18. |
| `@eslint/js` | 9.39.5 | Matches eslint major. |
| `vitest` + `@vitest/coverage-v8` | **3.2.7** | **NOT 4.x.** Vitest 4 requires Node ≥20; 3.x still supports Node 18. |
| `prettier` | 3.9.5 | Current major. |
| `globals` | 17.7.0 | Node globals for the plain-JS flat config file. |
| `tsx` | 4.23.1 | esbuild-based runner used to execute TS/`@contracts` at runtime (the bin). |
| `@types/node` | 20.19.43 | Pinned to the LTS matching the supported floor. |

**`engines.node` = `>=18.18.0`** (not plain 18.0 — ESLint 9 requires ^18.18).

The overarching rule the brief set — "pin exact, current, **mutually-compatible**"
— forced two "newest that still fits" choices (TS 5.9 not 7; ESLint 9 / Vitest 3
not 10 / 4). Chasing the absolute-latest majors would have silently broken either
type-aware linting or the mandated Node-18 floor. The boring, compatible set wins.

## 4. Deviations from the brief's literal wording — deliberate, forced, documented

The brief names **NodeNext**. The **read-only `contracts/`** make a *pure* NodeNext
pipeline impossible, and `contracts/` may not be edited. Proven empirically:

- Under `module/moduleResolution: NodeNext`, `tsc` emits **TS2835** ("relative
  import paths need explicit file extensions") on all 13 extensionless imports in
  `contracts/*` (`export * from "./tokens"` etc.). Build cannot pass.
- Plain Node ESM cannot run those extensionless specifiers at runtime either
  (`ERR_MODULE_NOT_FOUND`), regardless of aliasing.

**Resolution (the harder invariants win): keep ESM (`"type":"module"`) but use
`moduleResolution: "bundler"` (`module: ESNext`), paired with an esbuild-based
runtime.** `contract_immutable` (a manifest identity) and "build succeeds" are
non-negotiable; "NodeNext specifically" was a means to ESM correctness that the
contracts already preclude. Concretely:

1. **`moduleResolution: bundler`** — `tsc` passes cleanly against read-only
   contracts (proven: exit 0), and `@contracts`/`@core` resolve via `paths`.
2. **`verbatimModuleSyntax` is OFF** — contracts import types without
   `import type`, which that flag rejects (TS1484, 12×). `isolatedModules: true`
   gives the same esbuild single-file-transpile safety instead. Every *other*
   strong strict flag is ON (see §5).
3. **`npm run build` is a strict type-check gate (`noEmit`)**, not a JS emit. The
   emitted form of the extensionless contracts is not plain-Node-runnable, so the
   runtime is esbuild-based; a build that "type-checks the whole project" is the
   honest meaning of build here. The shipped `klein` CLI should be **run via tsx
   or bundled with esbuild at publish** (both proven to resolve everything) — a
   `cli`/publish decision, not scaffold's, but the mechanism is proven working.

## 5. Conventions every downstream stage MUST follow

- **Imports**: use **extensionless relative imports** (matching `contracts/`'s own
  style, e.g. `import { x } from "./foo"`) plus the aliases
  **`@contracts`** (→ `contracts/index.ts`) and **`@core`** (→ `src/core/index.ts`).
  Do NOT write `.js`/`.ts` extensions on relative imports — bundler resolution +
  esbuild runtime want extensionless. (`.ts` extensions require
  `allowImportingTsExtensions` and were deliberately not enabled.)
  Runtime aliasing is robust and proven, so the brief's relative-import *fallback*
  is **not** needed — use the aliases.
- **Strictness (all ON except `verbatimModuleSyntax`)**: `strict`,
  `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noPropertyAccessFromIndexSignature`, `isolatedModules`. No `any` in public
  surface (`@typescript-eslint/no-explicit-any: error`); exhaustive `switch`
  enforced (`switch-exhaustiveness-check: error`). Do not weaken these.
- **Tests**: Vitest, files `tests/**/*.{test,spec}.ts` or co-located
  `src/**/*.{test,spec}.ts`; import test API explicitly (`import { describe, it,
  expect } from "vitest"` — no globals). Coverage: v8, `src/**/*.ts`, ≥90% on
  lines/functions/branches/statements. `index.ts` barrels are coverage-excluded.
- **Lint/format scope**: `contracts/**` (read-only) and `SUBTASK_*/**` (kernel
  scaffolding) are excluded from ESLint and Prettier — they are not ours to
  relint/reformat. When `docs` adds `README.md`/`docs/*.md`, those ARE formatted
  (only kernel artifact markdown like `_GLOBAL.md`/`SUSPENSION.md` is ignored).

## 6. Notes / known environment quirk

- During install, this sandbox's allow-scripts guard skipped `esbuild`'s
  postinstall; the platform binary was nonetheless present and functional
  (esbuild 0.28.1, verified), so Vitest/tsx work. Under a normal `npm ci`
  (including CI) the postinstall runs unremarkably — no action needed.
- `bin.klein` points at `bin/klein.mjs` (owned later by `cli`); the target need
  not exist for install. CI's `npm ci` does not require it either.

## 7. Success criteria — all met

- [x] `npm install` resolves exact, mutually-compatible pins (lockfile committed).
- [x] `npm run build` succeeds with only `contracts/` present (empty `src/` builds
      clean — no "no inputs" error).
- [x] `npm run lint` and `npm run format:check` green against the repo as it stands.
- [x] `@contracts`/`@core` resolve at **compile time** (tsc `paths`) **and runtime**
      (Vitest alias + tsx) — proven end-to-end; no relative-import fallback needed.
- [x] CI workflow is valid YAML and mirrors the local gate (Node 18/20/22).
- [x] Exact versions pinned; compatibility reasoning recorded (§3).
- [x] `contracts/` unmodified; wrote only owned config/CI files.
