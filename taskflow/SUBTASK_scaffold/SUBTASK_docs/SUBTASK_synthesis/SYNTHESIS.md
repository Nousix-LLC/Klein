# `docs` subtree — synthesis & cross-document consistency verdict

**Task**: `SUBTASK_synthesis` (hub-and-spoke closer for the Klein `docs` subtree)
**Role**: integrity gate — proves the doc set composes; wires no new substance.
**Depends on**: `language` → `docs/LANGUAGE.md`, `grammar` → `docs/GRAMMAR.md`,
`project` → `README.md` + `LICENSE` + `CHANGELOG.md`. All three COMPLETED.

## Overall verdict: **PASS** ✅

Every `../_GLOBAL.md` §9 criterion is met. Zero cross-document drift was found
across LANGUAGE ↔ GRAMMAR ↔ README ↔ `contracts/` ↔ project hub §3. The delivered
Markdown passes `npm run format:check`. No orphan grammar productions and no
missing constructs. README commands/name/engine/bin match `package.json` exactly.
Out-of-scope features are documented as intentional in both LANGUAGE and README.
No sibling output was modified and `contracts/` was not touched by this task.

---

## Inputs verified (read at start)

| Source | Path | Bytes/mtime |
|---|---|---|
| Language spec | `docs/LANGUAGE.md` | 40047 · 01:33 |
| Grammar | `docs/GRAMMAR.md` | 19166 · 01:46 |
| README | `README.md` | 8151 · 01:31 |
| LICENSE | `LICENSE` | 1074 · 01:29 |
| CHANGELOG | `CHANGELOG.md` | 2204 · 01:30 |
| Ground truth | `contracts/{tokens,ast,values,errors,pipeline}.ts` | mtimes 00:50–00:52 |
| Manifest | `package.json` | 01:16 |
| Subtree hub | `../_GLOBAL.md` §4–§6, §9 | — |

`contracts/` mtimes (00:50–00:52) precede all doc authoring (01:29–01:46) —
positive evidence the ground truth was fixed before, and untouched by, the docs
children. (No git repo present here, so integrity is asserted from file state +
faithful mirroring rather than a `git diff`; see Caveats.)

---

## §9 criteria — per-criterion verdict + evidence

### §9.1 — Internal consistency + consistency with `contracts/` and hub §3; **zero drift** (names / codes / operators / precedence / truthiness / equality / literals) — **PASS**

- **Keywords** — `contracts/tokens.ts` `KEYWORDS` = `let fn return if else while
  for break continue true false null`. Mirrored verbatim: LANGUAGE (line 127),
  GRAMMAR `Keyword` production (lines 103–104), hub §4. `true`/`false`/`null`
  documented as keyword-spelled literal tokens (not identifiers) in both LANGUAGE
  and GRAMMAR. **Match.**
- **Token set** — `TokenType` enum (tokens.ts): 6 literal kinds, 9 keyword kinds,
  10 punctuation (`( ) { } [ ] , ; : .`), 15 operators (`+ - * / % = == != < >
  <= >= ! && ||`), `EOF`. GRAMMAR `Punctuator` + `Operator` productions enumerate
  all 10 + 15 with the exact `TokenType` name in each comment (LParen…Dot,
  Plus…Or); one synthetic `EOF`, last. **Match — complete, no extras.**
- **Comments** — `//` line, `/* */` block, block comments **do not nest**;
  unterminated block = `UnterminatedComment` `E1005`. LANGUAGE (99–114), GRAMMAR
  (83–92), README (72–73). **Match.**
- **Operator set + precedence/associativity** — the authoritative precedence
  table in LANGUAGE §Operators (levels 1–9) and the table reproduced in GRAMMAR
  §Expressions are **identical** in level number, operator membership,
  associativity, and AST node kind:
  1 `=` right AssignmentExpression · 2 `||` left LogicalExpression · 3 `&&` left
  LogicalExpression · 4 `== !=` left BinaryExpression · 5 `< > <= >=` left
  BinaryExpression · 6 `+ -` left BinaryExpression · 7 `* / %` left
  BinaryExpression · 8 unary `- !` right UnaryExpression · 9 postfix
  `f(...) a[i] o.k` left. Operator membership matches `ast.ts`
  `BinaryOperator` / `LogicalOperator` / `UnaryOperator` exactly; `&&`/`||` are
  kept a distinct `LogicalExpression` node "because they short-circuit" in both
  docs and the contract comment. GRAMMAR encodes the same precedence
  *structurally* (one production per level: `Assignment` → `LogicalOr` →
  `LogicalAnd` → `Equality` → `Relational` → `Additive` → `Multiplicative` →
  `Unary` → `Postfix` → `Primary`) and names LANGUAGE as governing on conflict.
  The six shared worked examples (`1 + 2 * 3`, `2 + 3 == 5`, `-2 * 3`,
  `a && b || c`, `x = y = 1`, `!a == b`) are identical in both; GRAMMAR adds the
  postfix-chain example `o.a[i](x).b → ((((o.a)[i])(x)).b)`, which LANGUAGE also
  states. README §"Language at a glance" lists the same operator set (summary,
  no precedence claim). **Match.**
- **Truthiness** — "only `null` and `false` are falsy; everything else (incl. `0`,
  `""`, `[]`, `{}`, functions, builtins) is truthy." LANGUAGE (474–480 + worked
  examples), README (37–38, 68–69), hub §4. GRAMMAR is syntax-only (correctly
  silent). **Match.**
- **Equality** — `==`/`!=` structural for primitives; arrays/objects/functions/
  builtins by **reference identity**; different kinds never equal; `NaN != NaN`.
  LANGUAGE §Equality (498–523) + Values table. README (70–71). **Match** (see
  Non-drift note 1 re: README's glance wording).
- **Literals** — numbers in three forms — decimal (`0 42 3.14 .5`), exponent
  (`1e10 6.022e23 2.5e-3`), hex (`0xFF 0x10 0xdead`); string escapes `\n \t \r
  \\ \" \0 \uXXXX`; array `[…]`; object `{ a: 1, "b": 2 }` with identifier-or-
  string keys resolving to string keys. LANGUAGE (Values) and GRAMMAR (`NUMBER`,
  `STRING`/`Escape`, `ArrayLiteral`, `ObjectLiteral`/`ObjectEntry`) agree, using
  the **same example literals**; both list all 7 escapes; both map object keys to
  `ObjectEntry.key: string`. Malformed number = `InvalidNumber` `E1004`,
  bad escape = `InvalidEscape` `E1003`, unterminated string = `UnterminatedString`
  `E1002` in both. **Match.**
- **`ErrorCode` set** — the full closed enum in `contracts/errors.ts` (5 lexical
  `E1001–E1005`, 5 syntax `E2001–E2005`, 13 runtime `E3001–E3013` = 23 codes) is
  reproduced **exactly and completely** in LANGUAGE §Error model catalogue —
  every code string and name matches, grouped by the same three phases
  (`lexical|syntax|runtime` = `ErrorPhase`). No invented codes anywhere; README
  references only the phase prefixes `E1xxx/E2xxx/E3xxx` and defers the full list
  to LANGUAGE. Diagnostic shape (severity, phase, code, message, span, +runtime
  `stack`) matches the `Diagnostic` interface. The rendered snippet+caret example
  (`error[E3001] … ^^^ not defined in this scope`) is **byte-identical** across
  `contracts/errors.ts`, LANGUAGE, and README. Error-tolerance posture (lexer/
  parser collect+recover; interpreter throws on first runtime fault; `interpret()`
  facade never throws for Klein-level faults) matches `pipeline.ts`
  (`LexResult`/`ParseResult`/`InterpretOutcome`). **Match.**

### §9.2 — GRAMMAR EBNF covers **every** hub §3 construct and **every** `contracts/ast.ts` node; no orphan productions, no missing constructs — **PASS**

- **Expression union (15 nodes)** — `NumberLiteral, StringLiteral, BooleanLiteral,
  NullLiteral, Identifier, ArrayLiteral, ObjectLiteral, FunctionLiteral,
  UnaryExpression, BinaryExpression, LogicalExpression, AssignmentExpression,
  CallExpression, IndexExpression, MemberExpression` — each has exactly one
  production per GRAMMAR §"AST coverage" table; independently re-checked against
  the productions. All 15 present.
- **Statement union (10 nodes) + `Program`** — `LetStatement, ExpressionStatement,
  BlockStatement, IfStatement, WhileStatement, ForStatement, ReturnStatement,
  BreakStatement, ContinueStatement, FunctionDeclaration, Program` — all 11 have
  productions. All present.
- **Supporting types** — `ObjectEntry`, `Parameter` (→ `IDENTIFIER` in
  `ParameterList`), `AssignmentTarget` (→ the target constraint on `Assignment`:
  Identifier | IndexExpression | MemberExpression, `InvalidAssignmentTarget`
  `E2004`), and the operator enums (→ literal operator terminals) are each mapped.
- **No missing constructs** — hub §4's called-out shapes are all covered:
  `if`/`else if` as `IfStatement` whose `alternate` is itself an `IfStatement`
  (`alternate = IfStatement | BlockStatement | null`, matching
  `ast.ts` `IfStatement.alternate`); `for` with three optional clauses
  (`ForStatement` init/condition/update each nullable; `for (;;)` infinite);
  object keys → strings; assignment `=` as an **expression**; postfix
  call/index/member.
- **No orphan productions** — the only non-node productions are `Grouping`
  (`"(" Expression ")"`, which by contract builds **no** node — parentheses only
  group; documented as such in both docs) and the dispatch/aggregation helpers
  (`ForInit`, `CallSuffix`/`IndexSuffix`/`MemberSuffix`, `ParameterList`,
  `ArgumentList`), each of which maps to a real AST field. `ForInit` correctly
  omits the trailing `;` (the for-header separators serve) and maps to
  `ForStatement.init: LetStatement | ExpressionStatement | null` — documented
  explicitly, not drift. **No production lacks a construct; no construct lacks a
  production.**

### §9.3 — README install/usage commands match `package.json` (scripts, `bin`, name, engine) — **PASS**

- **name** `klein`, **version** `0.1.0`, **`"type": "module"`** (ESM),
  **license** MIT, **`engines.node` `>=18.18.0`**, **`bin.klein` →
  `bin/klein.mjs`** — all reflected in README (title, "ESM package", Requirements
  "Node.js >=18.18.0", License §, and the `bin/klein.mjs` deferral note).
- **All 9 scripts match verbatim** (name → command → purpose): `build`
  (`tsc -p tsconfig.build.json`), `typecheck` (`tsc -p tsconfig.json --noEmit`),
  `lint` (`eslint .`), `lint:fix` (`eslint . --fix`), `format`
  (`prettier --write .`), `format:check` (`prettier --check .`), `test`
  (`vitest run`), `test:watch` (`vitest`), `coverage`
  (`vitest run --coverage`). README's npm-scripts table and the `npm run …`
  invocations in "Developing"/"Contributing" use only these exact names.
- **`bin` / run mechanism** — README shows `klein program.kl` / `klein` (REPL) as
  the **intended** UX and **explicitly defers** the published entry point
  (`bin/klein.mjs`) and npm-install/run workflow to the CLI/publish stage, giving
  the developer flow (`npm install`, then the npm scripts) instead. This is
  exactly the posture hub §5 requires ("MUST NOT claim a build/run mechanism the
  scaffold hasn't proven") — no confabulation. CHANGELOG carries the same
  deferral note. **Match.**

### §9.4 — Out-of-scope features documented as **intentional** (project hub §2) — **PASS**

All 7 non-goals appear as deliberate design decisions (not omissions) in **both**
LANGUAGE §"Intentional non-goals" and README §"Intentional non-goals": no
bytecode/JIT, no module/import system, no GC of Klein's own (relies on JS host
GC), no user-defined types/classes, no async/concurrency, no Klein package
manager, no static type checker for Klein programs. LANGUAGE frames each with a
rationale; README lists them tersely; CHANGELOG's scope notes are consistent.
**Match.**

### §9.5 — `npm run format:check` passes on the delivered Markdown (and `LICENSE`) — **PASS**

`npm run format:check` (`prettier --check .`) → **"All matched files use Prettier
code style!"**, exit 0. Run with Node v24.18.0 / npm 11.16.0 (nvm) from the
project root. Per `.prettierignore`, the checked set includes `README.md`,
`docs/LANGUAGE.md`, `docs/GRAMMAR.md`, `CHANGELOG.md`, and `LICENSE` (only
build/dep artifacts, `contracts/`, and `SUBTASK_*` kernel scaffolding are
ignored) — i.e. exactly the delivered docs are covered. This synthesis record
lives under `SUBTASK_*/` and is `SYNTHESIS.md`, both prettier-ignored, so writing
it does not affect the result. **Pass.**

### §9.6 — `contracts/` unmodified; no child wrote outside its ownership set — **PASS (with git caveat)**

- **Owned outputs all present, exactly partitioned**: `docs/LANGUAGE.md`
  (language), `docs/GRAMMAR.md` (grammar), `README.md` + `LICENSE` +
  `CHANGELOG.md` (project). `docs/` contains only the two `.md` files. No stray
  project file attributable to a docs child at the root.
- **No out-of-ownership writes**: project root holds only scaffold-authored
  tooling/config (`.gitignore`, `.npmignore`, `.prettier*`, `eslint.config.js`,
  `tsconfig*.json`, `vitest.config.ts`, `package*.json` — mtimes 01:12–01:16,
  authored by the earlier `tooling`/`scaffold` stage), the three project docs,
  and kernel artifacts (`_GLOBAL.md`, `SUSPENSION.md`). No `src/`, `tests/`, or
  `contracts/` write by any docs child.
- **`contracts/` intact**: all 7 files present (`_MANIFEST.yaml` + `ast.ts`,
  `errors.ts`, `index.ts`, `pipeline.ts`, `tokens.ts`, `values.ts`), mtimes
  00:50–00:52 — earlier than every doc-authoring mtime, and this task performed
  read-only access. This task wrote **only** its own `SYNTHESIS.md`.
- **Caveat**: no git repository is present at the project root, so this is
  asserted from file-state (mtimes, presence, partition) and read-only access
  rather than a `git diff --stat contracts/`. On the available evidence
  `contracts/` is unmodified and ownership held.

---

## Drift / gaps found

**None material.** Two benign, non-drift observations (recorded for
transparency, neither is an inconsistency and neither requires a fix):

1. **README equality/value glance omits the `builtin` kind by name.** README's
   at-a-glance bullets say "functions (closures)" and "compare arrays, objects,
   and functions by reference identity," where LANGUAGE's authoritative Values
   table additionally names the `builtin` kind (also reference-identity). This is
   a summary simplification in a section README explicitly labels "a quick
   summary; see LANGUAGE.md for the authoritative details"; builtins are a
   species of callable value and README states nothing contradictory. Not drift.
2. **README does not restate the precedence *table*.** README lists the operator
   *set* but no level numbers, deferring precedence to LANGUAGE/GRAMMAR. This is
   the intended division of labor, not an omission.

No action / plan amendment required.

## Method notes

Cross-references were checked construct-by-construct against the contracts as the
single source of truth (`tokens.ts` for the token/keyword vocabulary, `ast.ts`
for the node set and operator enums, `errors.ts` for the code catalogue and
render form, `values.ts` for `ValueKind`, `pipeline.ts` for the error-tolerance
posture), then LANGUAGE ↔ GRAMMAR ↔ README were checked against each other and
against `package.json`. Formatting was verified by executing the real
`format:check` script, not by inspection.

## Subtree result

**`docs` subtree: PASS.** The documentation set is internally consistent,
faithful to `contracts/` + project hub §3, grammar-complete against the AST,
command-accurate against `package.json`, correctly deferential where the scaffold
hasn't proven a mechanism, and Prettier-clean. Ready to report up to the
scaffold-level `verify` task.
