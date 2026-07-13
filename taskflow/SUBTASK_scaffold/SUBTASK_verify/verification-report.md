# Scaffold verification report — evidence log

Supporting evidence for `SYNTHESIS.md`. Every result below was produced by
running the **real** command (Node **v24.18.0** / npm **11.16.0** via nvm) from
the project root `/home/mattm/nousix-runtime/demos/language-interpreter/interpreter`,
not by assertion. The verifier wrote **no** project file; its only write is
`probe/alias_and_render_probe.ts` in this workspace.

---

## 0. Predecessor state (why `core`/`docs` have no `COMPLETE.md`)

My brief expected `../SUBTASK_core/COMPLETE.md` and `../SUBTASK_docs/COMPLETE.md`.
Both siblings **decomposed further** (kernel `NeedsDecompose` path), so each
produced a `SUSPENSION.md` + a `SUBTASK_synthesis/` child; their real completion
records are:

- `../SUBTASK_tooling/COMPLETE.md` (tooling was Atomic)
- `../SUBTASK_core/SUBTASK_synthesis/SYNTHESIS.md` (core subtree closer)
- `../SUBTASK_docs/SUBTASK_synthesis/SYNTHESIS.md` (docs subtree closer)

All three report their subtrees COMPLETE, and — decisively — **every work
product is present in the project tree** (`src/core/**`, `tests/core/**`,
`docs/**`, `README`/`LICENSE`/`CHANGELOG`, and the full toolchain). Composition
is therefore verifiable directly against the tree, which is what this report does.

## 1. Environment

```
node -v            -> v24.18.0        (nvm)
npm -v             -> 11.16.0
git repo present?  -> no  (immutability asserted via sha256 + mtime + read-only access)
engines.node       -> >=18.18.0       (satisfied by 24.18.0; CI covers 18/20/22)
```

## 2. Toolchain gate — actual command results

| Command | Script | Exit | Observed |
|---|---|---|---|
| `npm ci` | reproducible install | **0** | 67 pkgs; 0 vulnerabilities; esbuild postinstall skipped by sandbox allow-scripts guard (documented quirk — binary present & functional) |
| `npm run build` | `tsc -p tsconfig.build.json` | **0** | clean; strict; `src/core/` only present |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit` | **0** | clean |
| `npm run lint` | `eslint .` | **0** | zero errors |
| `npm run format:check` | `prettier --check .` | **0** | "All matched files use Prettier code style!" |
| `npm test` | `vitest run` | **0** | **38 passed** (span 14 · diagnostic 14 · errors 10) |
| `npm run coverage` | `vitest run --coverage` | **0** | thresholds met (below) |

### Coverage (v8, `src/**/*.ts`, barrels excluded)

```
File            | % Stmts | % Branch | % Funcs | % Lines
All files       |   100   |  94.73   |   100   |   100
 diagnostic.ts  |   100   |  91.42   |   100   |   100   (uncovered branch: 73,78,161)
 errors.ts      |   100   |   100    |   100   |   100
 span.ts        |   100   |   100    |   100   |   100
Statements 199/199 · Branches 54/57 · Functions 22/22 · Lines 199/199
```

All four metrics ≥ 90% threshold (configured in `vitest.config.ts`). Thresholds
were previously proven to *bite* (tooling/COMPLETE §2).

## 3. Path aliases — compile AND runtime

- **Compile time**: `tsconfig.json` `paths` maps `@contracts`→`contracts/index.ts`,
  `@core`→`src/core/index.ts` (+ wildcard forms). `tsc` (build + typecheck) exit 0
  ⇒ compile-time resolution proven.
- **Runtime**: `probe/alias_and_render_probe.ts` imports from **both** `@core` and
  `@contracts` and was executed via the project's `tsx` (the esbuild runtime the
  eventual `klein` bin uses), cwd = project root so project tsconfig `paths` apply:

```
ALIAS_RUNTIME_OK: imported @core + @contracts at runtime
instanceof Error        : true
instanceof KleinErrorBase: true
code is ErrorCode enum  : true
carries span            : true
phase (class-fixed)     : runtime
PROBE_EXIT=0
```

⇒ Aliases resolve at runtime too. The brief's relative-import fallback is **not**
needed; the alias convention holds end-to-end. (Vitest's own runtime alias set in
`vitest.config.ts` is independently exercised by the 38 passing tests.)

## 4. Diagnostic renderer vs `contracts/errors.ts` layout

Probe render (color off):

```
error[E3001]: undefined variable 'foo'
 --> undefined:3:11
  |
3 |   let y = foo + 1;
  |           ^^^
```

Contract docstring layout (`contracts/errors.ts` lines 100–104):

```
error[E3001]: undefined variable 'foo'
 --> script.kl:3:9
  |
3 |   let y = foo + 1;
  |           ^^^ not defined in this scope
```

**Structural match: PASS** — header `severity[CODE]: message`, ` --> src:line:col`
locator, blank gutter, `line | source`, caret run under the span. Two benign,
explained differences:
- **Unlabelled caret** — the `Diagnostic` contract exposes a single `message`
  (placed in the header) and no caret-label field; `src/core/diagnostic.ts` lines
  23–30 document leaving the caret unlabelled rather than confabulating a field.
  The illustrative `^^^ not defined in this scope` in the docstring is example-only.
- **`undefined:` filename** — the renderer reads `span.source` (`diagnostic.ts`
  line 147); my probe's `makeSpan` left `source` unset. This is a **probe-input
  artifact**, not a renderer defect — the filename slot works (real spans from the
  lexer carry `source`). Column `3:11` vs docstring `3:9` is likewise just the
  example's own coordinates.

## 5. Contract immutability

sha256 (first 16 hex) + size + mtime, identical **before and after** the full run:

```
ee2a101d3f851a17   4460 B  00:52:55  _MANIFEST.yaml
87eadebfc40cf35d   7936 B  00:51:35  ast.ts
66e17777ee7ec217   3708 B  00:51:08  errors.ts
c44ff4b5bd44355d    386 B  00:52:32  index.ts
23d53094091ea542   2745 B  00:52:19  pipeline.ts
0a7d75ba47cf21da   3857 B  00:50:44  tokens.ts
be6471c8e8aff47a   6704 B  00:52:02  values.ts
```

All contract mtimes (`00:50–00:52`) **precede** every scaffold write
(tooling 01:12–01:16, core ≤01:27, docs ≤01:46) — positive evidence the ground
truth was fixed first and never edited. No `contracts/` file changed during
verification. **PASS** (git-diff unavailable; asserted via checksum+mtime+read-only).

## 6. Ownership — full path enumeration → single owner

Every non-kernel, non-dependency deliverable, mapped to exactly one owner:

| Path(s) | Owner | In manifest `owns`? |
|---|---|---|
| `.github/workflows/ci.yml`, `.gitignore`, `.npmignore`, `.prettierrc.json`, `eslint.config.js`, `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` | tooling | ✅ (9/9) |
| `package-lock.json`, `.prettierignore` | tooling | ⚠️ **not enumerated** (see note) |
| `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/LANGUAGE.md`, `docs/GRAMMAR.md` | docs | ✅ (5/5) |
| `src/core/{span,errors,diagnostic,index}.ts`, `tests/core/{span,errors,diagnostic}.test.ts` | core | ✅ |
| `contracts/**` | root (read-only) | n/a |

- **No cross-task trespass**: no path falls in another child's set; the three
  scaffold children are disjoint (tooling ∩ core ∩ docs = ∅).
- **No stray in a later pipeline stage's territory**: no `src/{lexer,parser,runtime,
  stdlib,cli}`, no `src/index.ts`, no `examples/`, no `tests/{integration,errors}`.
- **Note (flagged, not smoothed over)**: `package-lock.json` and `.prettierignore`
  are authored by tooling (tooling/COMPLETE §1) and live squarely in scaffold's
  config domain — owned by *no other* task — but are absent from
  `_MANIFEST.yaml → ownership.scaffold.owns`. This is a manifest **under-enumeration**,
  not an ownership violation: nothing wrote into a foreign subtree. Recommendation
  for a later task: add these two paths to the manifest. (`contracts/` is read-only;
  the verifier cannot and did not edit it.)

## 7. `no_any` in public surface

`tsc` strict (build + typecheck) green with `@typescript-eslint/no-explicit-any:
error` (tooling/COMPLETE §5) also green under `eslint .`. The `@core` barrel
(`src/core/index.ts`) re-exports only concrete behavior + one type-only
`RenderOptions`; no `any` in the exported surface.

## 8. Docs consistency (independent spot-check)

- **README scripts vs `package.json`**: all 9 scripts (`build`, `typecheck`,
  `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `coverage`)
  appear in README's table (lines 146–154) with **verbatim** commands. `name`
  (`klein`), `bin` (`bin/klein.mjs`), `engines.node` (`>=18.18.0`), ESM, MIT all
  reflected. **Match.**
- **Vocabulary**: `contracts/tokens.ts` `KEYWORDS`, the operator set
  (`&& || % <= !=` …), and sampled `ErrorCode`s (`E1001 E1005 E2004 E3001 E3013`)
  all appear in `docs/LANGUAGE.md` / `docs/GRAMMAR.md`. Consistent with the docs
  subtree's exhaustive check.
- **One flagged inaccuracy (residual doc debt)**: README line 113
  (`# type-check and emit with tsc`) and the script table line 146
  ("Type-check **and emit** the build output") describe `npm run build` as
  emitting output. `tsconfig.build.json` sets `noEmit: true` (build is a strict
  type-check **gate**, no JS emitted — tooling/COMPLETE §4). The command *name* and
  *string* match; only the prose overstates. Minor; **does not** affect
  composition. Not fixed here (verifier does not write docs) — handed to a later
  docs-fix/remediation task.

## 9. Downstream-binding import convention (record for lexer → … → cli)

Whatever `tooling` proved, all later stages use:

- Extensionless **relative** imports inside a subtree (`import { x } from "./foo"`).
- Aliases **`@contracts`** (→ `contracts/index.ts`) and **`@core`**
  (→ `src/core/index.ts`) — compile via tsconfig `paths`, runtime via Vitest alias
  + tsx/esbuild. Both proven end-to-end. No relative-import fallback needed.
- Import **types/vocabulary from `@contracts`**, **behavior from `@core`**
  (the `@core` barrel deliberately does not re-export contract types).
- `moduleResolution: "bundler"`, `module: "ESNext"`, ESM (`"type":"module"`),
  `isolatedModules: true`; full strict set **except** `verbatimModuleSyntax`
  (off — required by the read-only contracts' non-`import type` type imports).
- Vitest API imported explicitly (no globals); tests key off `ErrorCode`, never
  message text; `≥90%` coverage on `src/**`, `index.ts` barrels excluded.
- Runnable `klein` uses the **tsx/esbuild runtime or an esbuild bundle at publish**
  (a cli/publish concern) — plain `node` cannot run the extensionless contract
  emit. Mechanism proven working.
