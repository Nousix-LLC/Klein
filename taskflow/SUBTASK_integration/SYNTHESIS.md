# Klein — Integration Synthesis & Release-Gate Verdict

**Role:** synthesis-hub record for the `integration` subtree and the whole Klein
decomposition. This document certifies the composed interpreter against the
machine-checkable integration identities in `../contracts/_MANIFEST.yaml` and
gives a single GO / NO-GO verdict. It is written to be self-contained: a reader
who has seen no other file in the tree can understand what Klein is, how it was
verified, and whether it is fit to ship.

**Verification run:** 2026-07-13, from the project root
`/home/mattm/nousix-runtime/demos/language-interpreter/interpreter`, Node
`v24.18.0`, npm `11.16.0` (project requires Node ≥ 18.18.0). All checks were
**read-only**; this task authored no source, test, example, or contract file —
only this record.

---

## VERDICT: **GO** ✅

All nine `_MANIFEST.yaml` integration identities are satisfied. Two identities
carry an honest, explicitly-scoped **qualification** (documented below and in the
identity table): `contract_immutable` was verified by a filesystem-timestamp
fallback because the working tree is **not a git repository**, and
`ownership_respected` holds substantively (no task wrote into another task's
territory; every artifact has exactly one producer) but the root
`_MANIFEST.yaml` ownership list is **under-inclusive** relative to what
`SUBTASK_scaffold` legitimately owns. Neither qualification reflects a defect in
the delivered interpreter, and neither is a silent pass — each is reported with
its evidence and the responsible party. No check was patched to make it pass.

---

## 1. What Klein is

**Klein** is a small, genuinely usable, dynamically-typed programming language
with a **tree-walking interpreter** implemented in strict TypeScript for Node.js
(ESM, `NodeNext`). The engineering bar is "production quality at Google/Meta,"
operationalized as: strict typed + lint-clean + formatted; well-tested with high
coverage; first-class source-anchored diagnostics; a real CLI + REPL published as
an npm package with a `bin`; and complete documentation (README, language spec,
EBNF grammar). The deliberate posture is that the *boring* choice is the
courageous one — a tree-walker (not a bytecode VM) is chosen for clarity and
maintainability because the language is small.

**The language (summary; full spec in `docs/LANGUAGE.md`, grammar in
`docs/GRAMMAR.md`):**

- **Values:** `null`, booleans, IEEE-754 numbers, strings, arrays, insertion-
  ordered string-keyed objects, first-class closures, and builtins.
- **Bindings & scope:** `let x = expr;`; assignment is an expression; lexical
  block scope with shadowing.
- **Operators:** `+ - * / %` (`+` also concatenates strings), comparisons,
  short-circuit `&& || !`, unary `- !`, indexing `a[i]`, member `o.k`, call
  `f(x)`.
- **Control flow:** `if/else if/else`, `while`, C-style `for`, `break`,
  `continue`.
- **Functions:** `fn name(...){...}` declarations and `fn(...){...}` expressions;
  first-class, close over their defining scope; `return`.
- **Semantics that are documented and tested:** only `null` and `false` are
  falsy (`0` and `""` are truthy); `==`/`!=` are structural for primitives and
  reference-identity for arrays/objects/functions; integers print without a
  trailing `.0`; object key order is insertion order.

## 2. Architecture and how the stages compose against `contracts/`

Klein is a classic, separable pipeline. Each stage is an independent module that
imports its interfaces **literally** from the read-only `contracts/` layer (the
machine-verifiable compositional schema; `_GLOBAL.md` files are the prose
README, `contracts/` is the typed `interfaces/`):

```
source ──▶ Lexer ──▶ Token[] ──▶ Parser ──▶ AST(Program) ──▶ Interpreter ──▶ Value
                                                              ▲
                                              stdlib builtins ┘  (installed into globals)
                          CLI / REPL drive the whole pipeline via interpret()
```

| Stage (owner task) | Contract it implements | Source subtree |
|---|---|---|
| Shared core (`scaffold`) | `errors.ts` concrete classes, Span helpers, `DiagnosticFormatter` | `src/core/**` |
| Lexer (`lexer`) | `pipeline.ts#Lexer` (error-tolerant, recovers) | `src/lexer/**` |
| Parser (`parser`) | `pipeline.ts#Parser` (Pratt, recovering) | `src/parser/**` |
| Interpreter (`runtime`) | `values.ts#{Value, Environment, Interpreter}` | `src/runtime/**` |
| Stdlib (`stdlib`) | `values.ts#BuiltinImpl` set + registry | `src/stdlib/**` |
| Facade / CLI / REPL (`cli`) | `pipeline.ts#{InterpretOutcome, InterpretFacadeOptions}` | `src/index.ts`, `src/cli/**`, `bin/**` |
| Examples + E2E + this gate (`integration`) | asserts the `_MANIFEST.yaml` identities | `examples/**`, `tests/integration/**`, `tests/errors/**` |

**Error model:** lexer and parser *collect* diagnostics and recover (many errors
per run); the interpreter throws on the first runtime fault (with a stack), which
the `interpret()` facade catches and reduces to a structured `InterpretOutcome`
— it never throws to its caller for a Klein-level fault. Every diagnostic is
source-anchored (line/column), rendered with a snippet + `^` caret + `--> name:line:col`.
Tests key off structured `ErrorCode` values, never message text.

**Public surface (`src/index.ts`):** exactly `interpret()` plus the deliberate
type/vocabulary/error-class exports a consumer needs; the pipeline internals are
hidden. The real executable is `node bin/klein.mjs <file.kl>` (stdout = program
output, stderr = rendered diagnostics, exit `0`/`1`/`2`); `klein` with no args
starts the REPL.

## 3. Integration identities — verdicts and evidence

Every identity in `../contracts/_MANIFEST.yaml#identities` was executed and its
verdict recorded with the salient evidence.

| # | Identity | Verdict | Command(s) | Evidence |
|---|---|---|---|---|
| 1 | `compiles` | **PASS** | `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) and `npm run build` (`tsc -p tsconfig.build.json`) | Both exit `0`, zero errors, strict mode. |
| 2 | `lints_clean` | **PASS** | `npm run lint` (`eslint .`) | Exit `0`, zero errors/warnings. |
| 3 | `formatted` | **PASS** | `npm run format:check` (`prettier --check .`) | "All matched files use Prettier code style!" |
| 4 | `tests_pass` | **PASS** | `npm test` / `npm run coverage` (`vitest run`) | **27 test files, 532 tests, all green** — includes the new `tests/integration/**` (`examples.test.ts` 7, `process.test.ts` 2) and `tests/errors/**` (`errors.test.ts` 6). |
| 5 | `coverage` | **PASS** | `npm run coverage` (`vitest run --coverage`, v8) | **Lines 98.7 %** (2740/2776) on `src/` — well ≥ 90 %. Statements 98.7 %, Branches 97.09 %, Functions 99.42 %. Every `src/` subtree ≥ 96.37 % lines (lowest: `runtime/interpreter.ts` 96.37 %). Tool-reported, not hand-computed. |
| 6 | `contract_immutable` | **PASS (qualified — fallback)** | git unavailable → filesystem-timestamp fallback | Working tree is **not a git repo** (`git rev-parse` → fatal), so the intended `git status/diff -- contracts/` baseline could not be used. Fallback: every file under `contracts/` has an mtime in **00:50:44–00:52:55** (root-authorship window), predating the root `_GLOBAL.md` (00:53:57), `SUBTASK_scaffold` (01:02:37), and the **oldest** `src/` file (01:08:38) by ≥ 16 minutes. This is strong evidence of non-modification since root authorship, but is **timestamp evidence, not a content/hash baseline** — see §4. |
| 7 | `ownership_respected` | **PASS (qualified — root manifest under-inclusive)** | Enumerated every non-scaffolding project artifact; mapped each to the `ownership:` map | Every source/test/config artifact maps to **exactly one producing task** with **zero cross-task collisions**. Exception: three artifacts are legitimately `SUBTASK_scaffold`'s but are **not listed** in root `_MANIFEST.yaml#ownership.scaffold.owns` — see §4. Responsible party: **root manifest authorship**, not any executing task. |
| 8 | `examples_run` | **PASS** | Data-driven Vitest suites + direct `bin/klein.mjs` spot-checks | `examples/index.json` enumerates **10** examples (6 `ok`, 4 `error`); **10** `.kl` files on disk. The integration/error suites iterate the manifest (no per-example hard-coding) and are green over all entries, incl. a true child-process `bin/klein.mjs` smoke test. Direct spot-checks (`NO_COLOR=1`): `fibonacci` (ok) → stdout matches golden, exit 0, empty stderr; `errors_undefined` & `errors_type` (error) → stdout **and** rendered `.diag` match goldens byte-exact, exit 1. |
| 9 | `no_any_leak` | **PASS** | Strict `tsc` (identity 1) + targeted scan of `src/**` and the public surface | Strict-mode `compiles` is the primary evidence. A scan for `any` type positions (`: any`, `<any>`, `as any`, `any[]`) in `src/**` found **zero type annotations**; the single lexical `any` hit is prose inside a JSDoc comment (`parser.ts:231`). `src/index.ts` exports only typed contract types/classes — no `any` on the public surface. |

**Bottom line:** 9/9 identities satisfied; identities 6 and 7 carry the scoped
qualifications detailed next.

## 4. The two qualifications (reported, not silently passed)

**(a) `contract_immutable` verified by fallback, not git.** The project directory
is not under version control (no `.git`), so the manifest's preferred evidence
(`git status --porcelain contracts/` + `git diff -- contracts/`) is unavailable.
The fallback used is filesystem mtime ordering: all seven `contracts/` files were
last modified between 00:50 and 00:53 — the earliest timestamps in the entire
tree, strictly before any descendant task's source (oldest `src/` file at
01:08). No descendant could have edited a contract without updating its mtime
past that window, so the contracts are, to the resolution of this evidence,
**unchanged since root authorship**. Residual limitation: mtimes are not a
cryptographic/content baseline; a future run should introduce a git baseline (or
committed content hashes) so `contract_immutable` can be asserted by content
rather than by timestamp. This is a **verification-infrastructure gap, not a
Klein defect**.

**(b) `ownership_respected` holds substantively; the root manifest is
under-inclusive.** Auditing every non-scaffolding artifact against
`_MANIFEST.yaml#ownership`, three items fall outside any declared ownership glob:

| Artifact | True owner | Why it is not a violation |
|---|---|---|
| `tests/core/**` (3 files) | `SUBTASK_scaffold` | Scaffold's **own** subtree hub and brief explicitly claim `src/core/**` **and** `tests/core/**` (its `core` child owns both). The root `_MANIFEST.yaml` lists only `src/core/**` for scaffold — it omits `tests/core/**`. |
| `.prettierignore` | `SUBTASK_scaffold` | Standard companion to scaffold's `.prettierrc.json`/`.gitignore`/`.npmignore`; a tooling-config artifact the tooling task authored. Not enumerated in the manifest. |
| `package-lock.json` | `SUBTASK_scaffold` | Generated lockfile produced by `npm install` against scaffold's `package.json`. Not enumerated in the manifest. |

No task wrote into **another** task's subtree; there is no overlap and exactly
one producer per artifact — the substantive property the identity guards is
fully satisfied. The discrepancy is that the **root manifest's** `ownership:` map
does not enumerate the complete set scaffold legitimately owns. Recommended
additive fix (owned by whoever maintains `contracts/_MANIFEST.yaml`, i.e. the
root/contract layer — **not** a patch this task may make): add `tests/core/**`,
`.prettierignore`, and `package-lock.json` to `ownership.scaffold.owns`. Filed
here as an advisory; it does not gate the release.

## 5. Known gaps & intentional debt (from `../../_GLOBAL.md §2`)

These are **documented design decisions, not omissions or defects**, and do not
affect the GO verdict:

- No bytecode/JIT compilation — a tree-walker is the deliberate choice for a
  small language.
- No module/import system; no package manager for Klein programs.
- No garbage collector — Klein relies on the JS host GC.
- No user-defined types/classes.
- No async/concurrency.
- No static type checker for Klein programs (Klein is dynamically typed).

Additionally, the engine's **software-methodology bundle was unavailable** to
this deployment (`agent_domain_unset`); methodology is encoded directly in
`contracts/`, the `_GLOBAL.md` hubs, and the briefs. This decomposition
deliberately follows standard, well-trodden interpreter-construction practice
(Pratt parser, tree-walking evaluator, structured diagnostics), so nothing here
contradicts conventional methodology.

## 6. How to consume this delivery

- **As a library:** `import { interpret } from "klein"` → `interpret(source, opts)`
  returns `InterpretOutcome { ok, value, diagnostics }`; it never throws for a
  Klein-level fault. Route program output by passing `opts.write`.
- **As a CLI:** `node bin/klein.mjs <file.kl>` runs a file (stdout = program
  output, stderr = rendered diagnostics, exit `0` ok / `1` diagnostics / `2`
  usage-or-I/O); `node bin/klein.mjs` with no file starts the REPL. Honors
  `NO_COLOR`.
- **To re-verify this gate:** from the project root, run `npm run typecheck &&
  npm run build && npm run lint && npm run format:check && npm run coverage`, then
  spot-run any `examples/*.kl` through `bin/klein.mjs` and diff against its
  `examples/<name>.out` / `.diag` golden.
- **Reproducibility note:** run the CLI with `FORCE_COLOR` **unset** and
  `NO_COLOR=1` when diffing against `.diag` goldens — a shell with `FORCE_COLOR`
  set makes Node emit an unrelated stderr warning that is not part of the golden.

## 7. Certification

Klein composes end-to-end against its contract layer and satisfies every
integration identity: it compiles strict and clean, is lint- and format-green,
passes all 532 tests across 27 files with 98.7 % line coverage on `src/`, runs
every committed example against generated goldens, and leaks no `any` on its
public surface. The two qualifications above are verification-infrastructure and
manifest-completeness notes with named owners and recommended additive fixes;
neither is a defect in the delivered interpreter and neither was silently passed.

**Release gate: GO.**
