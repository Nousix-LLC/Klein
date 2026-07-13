# SYNTHESIS — `scaffold` subtree (Klein skeleton composes)

**Task**: `scaffold.verify` — synthesis hub proving `tooling` + `core` + `docs`
compose into a clean, buildable skeleton. **Decompose evaluation**: Atomic
(reached independently against my own brief — one cohesive verify/synthesize
responsibility; reading many inputs is synthesis, which is atomic-compatible).
**Status**: COMPLETED. **Verdict: the `scaffold` subtree PASSES `../_GLOBAL.md`
§9.**

Everything below was proven by running the **real** toolchain (Node v24.18.0 /
npm 11.16.0 via nvm) from the project root, not by assertion. Full command log,
coverage table, probe output, and checksums are in the companion
`verification-report.md`. I wrote **no** project source/config/doc file; my only
write outside this record is `probe/alias_and_render_probe.ts` in my own workspace.

---

## 1. Predecessor state resolved

My brief expected sibling `COMPLETE.md`s for `core` and `docs`. Both siblings
legitimately **decomposed further** (`NeedsDecompose`), so their real completion
records are `SUBTASK_core/SUBTASK_synthesis/SYNTHESIS.md` and
`SUBTASK_docs/SUBTASK_synthesis/SYNTHESIS.md` (tooling stayed Atomic:
`SUBTASK_tooling/COMPLETE.md`). All three report their subtrees complete, and —
decisively — **every work product is physically present** in the project tree, so
composition was verified directly against the tree rather than trusted from a
sibling record.

## 2. In-scope `_MANIFEST.yaml` identities — asserted with evidence

| Identity | Verdict | Command / evidence (observed result) |
|---|---|---|
| `compiles` | **PASS** | `npm run build` (`tsc -p tsconfig.build.json`, strict) → exit 0; `npm run typecheck` → exit 0 |
| `lints_clean` | **PASS** | `npm run lint` (`eslint .`) → exit 0, zero errors |
| `formatted` | **PASS** | `npm run format:check` (`prettier --check .`) → exit 0, "All matched files use Prettier code style!" |
| `tests_pass` | **PASS** | `npm test` (`vitest run`) → exit 0, **38 passed** (span 14 · diagnostic 14 · errors 10) |
| `coverage` (`src/core`) | **PASS** | `npm run coverage` → exit 0; Stmts **100** / Branch **94.73** / Funcs **100** / Lines **100** — all ≥ 90% threshold (barrels excluded) |
| `contract_immutable` | **PASS** | sha256 + size + mtime of all 7 `contracts/` files **identical before & after** the run; mtimes `00:50–00:52` precede every scaffold write; no `contracts/` write during verification |
| `ownership_respected` | **PASS** (1 note) | every deliverable path maps to exactly one owner; children disjoint; no stray in any later pipeline stage's territory. **Note**: `package-lock.json` + `.prettierignore` are tooling-authored, in scaffold's config domain, owned by no other task, but **not enumerated** in `ownership.scaffold.owns` — a manifest under-enumeration, not a violation |
| `no_any_leak` | **PASS** | `tsc` strict green + `@typescript-eslint/no-explicit-any: error` green; `@core` public surface exposes no `any` |

### Brief-specific structural checks (beyond the manifest subset)

| Check | Verdict | Evidence |
|---|---|---|
| Path aliases resolve **compile AND runtime** | **PASS** | tsc `paths` (compile) + `tsx` probe importing `@core`+`@contracts` (runtime, exit 0) — the alias convention holds end-to-end; relative-import fallback **not** needed |
| Diagnostic renderer matches `contracts/errors.ts` layout | **PASS** | probe render reproduces header / `-->` locator / gutter / snippet / caret exactly; unlabelled caret is a **documented** divergence (contract has one `message`, no caret-label field); `undefined:` filename is a probe-input artifact (`span.source` left unset), not a defect |
| Docs consistency (README↔`package.json`; spec/grammar↔`contracts/`) | **PASS** (1 flagged) | all 9 scripts + `name`/`bin`/`engine` match verbatim; keywords/operators/`ErrorCode`s mirror `contracts/`. **One inaccuracy flagged** (§4) |

## 3. Downstream-binding import convention (lexer → parser → runtime → stdlib → cli)

Every later stage MUST follow this, proven working here:

- **Extensionless relative** imports inside a subtree; aliases **`@contracts`**
  (→ `contracts/index.ts`) and **`@core`** (→ `src/core/index.ts`) for cross-tree.
  Resolve at compile (tsconfig `paths`) and runtime (Vitest alias + tsx/esbuild).
- Import **vocabulary/types from `@contracts`**, **behavior from `@core`** (the
  `@core` barrel does not re-export contract types — one source of truth).
- `moduleResolution: "bundler"`, `module: "ESNext"`, ESM; `isolatedModules: true`;
  full strict set **except** `verbatimModuleSyntax` (off — mandated by the
  read-only contracts' type imports; `contracts/` may not be edited).
- Vitest API imported explicitly (no globals); tests key off `ErrorCode`, never
  message text; ≥90% coverage on `src/**`, `index.ts` barrels excluded.
- The runnable `klein` bin uses the **tsx/esbuild runtime or an esbuild publish
  bundle** (a `cli`/publish decision) — plain `node` cannot execute the
  extensionless contract emit. Mechanism proven; no scaffold action outstanding.

`@core` public surface downstream may rely on (from core synthesis §4): span
helpers `makePosition/makeSpan/pointSpan/mergeSpans/spanLength`; error classes
`KleinErrorBase/LexicalError/SyntaxErr/RuntimeErr` (`.toDiagnostic()` → contract
`Diagnostic`; `RuntimeErr.callStack` maps to `Diagnostic.stack`); renderer
`DiagnosticFmt/diagnosticFormatter/formatDiagnostic` + `type RenderOptions`.

## 4. Residual gaps / intentional debt handed forward (reported, NOT fixed here)

Per the brief I report defects rather than fix them; remediation is a
parent/session decision.

1. **README overstates `npm run build` (minor doc inaccuracy).** README line 113
   (`# type-check and emit with tsc`) and the script table ("Type-check **and
   emit** the build output") claim emission, but `tsconfig.build.json` sets
   `noEmit: true` — build is a strict type-check **gate** producing no JS. Command
   name/string match; only the prose is wrong. Does not affect composition.
   → Recommend a small docs-fix task (owner: a future `docs` remediation or `cli`
   when it defines the real emit/publish path).
2. **Manifest under-enumerates two tooling artifacts.** `package-lock.json` and
   `.prettierignore` are legitimately tooling-authored and in scaffold's config
   domain but absent from `ownership.scaffold.owns`. Not an ownership breach.
   → Recommend adding them to `_MANIFEST.yaml` (root-owned/read-only, so a root or
   session amendment, not this verifier).
3. **Diagnostic caret is unlabelled** — deliberate (the `Diagnostic` contract has
   no caret-label field); the docstring's `^^^ not defined in this scope` label is
   illustrative. Structural layout matches. No action needed.
4. **`npm run build` ≠ runnable artifact** — it type-checks; the runnable `klein`
   needs tsx or an esbuild bundle (cli/publish concern). Mechanism proven working.
5. **No git repo present** — `contract_immutable` and `ownership_respected` are
   asserted from sha256 + mtime + read-only access rather than `git diff`.
6. **Methodology bundle unavailable** (`agent_domain_unset`, per hubs §5/§8) —
   methodology taken from `contracts/`, the ancestor hubs, and sibling records;
   sufficient for this well-trodden work. No gap confabulated across.

## 5. Environment note

Verified on Node **v24.18.0** (nvm); `engines.node` `>=18.18.0` is satisfied. The
pinned toolchain (tooling/COMPLETE §3) targets the Node-18 floor deliberately;
CI mirrors the gate on Node 18/20/22. The sandbox allow-scripts guard skipped
esbuild's postinstall, but the binary was present and functional (Vitest/tsx
worked); a normal `npm ci` runs it unremarkably.

---

## Handoff

**`scaffold` is COMPLETE and composes.** The Klein skeleton builds, type-checks,
lints, formats, tests (38 green), and covers `src/core/` ≥90% — all proven by real
commands against a read-only, unmodified `contracts/`. `lexer` (and every later
stage) may now build against a fixed toolchain and `import { … } from "@core"` /
`"@contracts"` per §3, with the three flagged non-blocking debts in §4 handed
upward for the parent/session to schedule. No plan amendment required; no defect
was fixed in this task (verifier scope).
