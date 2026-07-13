# Klein — `docs` subtree hub (`_GLOBAL.md`)

**Subtree hub.** Shared, write-once context for every task in the `docs`
decomposition. Each child reads this file, its own `SUBTASK_*/_BRIEF.md`, the
scaffold hub `../../_GLOBAL.md`, the project hub `../../../_GLOBAL.md`, and treats
`../../../contracts/` as **read-only** ground truth.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Parent**: `SUBTASK_docs`
(see `../_BRIEF.md`).

---

## 1. Why this subtree exists

`SUBTASK_docs` authors Klein's user- and contributor-facing documentation. Its
brief enumerates **distinct documentation concerns** and its combined output is
well over 400 lines across five files. Applying the kernel decomposition triggers
to the `docs` brief:

- **Output-Size** fires: the authoritative `docs/LANGUAGE.md` alone is a
  substantial spec (values, scope, operator precedence, control flow, closures,
  truthiness, equality, literals, error model); with `docs/GRAMMAR.md` (full EBNF),
  `README.md`, `LICENSE`, and `CHANGELOG.md` the set is ≫ 400 lines.
- **Scope / Distinct-Concerns** fires: the authoritative language-semantics spec,
  the formal EBNF grammar, and the project onboarding/meta docs are things
  different specialists could author in parallel from the same fixed contracts.
- **Single-Responsibility** fires: a faithful description conjoins distinct verbs
  — *specify* semantics **and** *formalize* the grammar **and** *write* onboarding
  docs.

So `docs` decomposes rather than executing as one invocation. This hub records
the split, the shared ground truth every child inherits, and the anti-drift
contract that keeps the documents mutually consistent.

## 2. Objective (subtree)

Produce a complete, internally consistent documentation set that is the
**authoritative narrative expansion** of what `contracts/` and the project hub §3
already fix — inventing **no** new semantics. The docs must match the code the
rest of the project will build against, so downstream stages and users read one
coherent story.

## 3. Scope

**In scope (this subtree):** `README.md`, `docs/LANGUAGE.md`, `docs/GRAMMAR.md`,
`LICENSE`, `CHANGELOG.md` — all authored at the **project root** `../../../`.

**Out of scope:** any source (`src/**`), tests, tooling/config, examples, and the
`contracts/` schema. Do not create or edit them. Do not invent language behavior
beyond hub §3 + `contracts/`; if a genuine gap/contradiction is found, document it
explicitly and flag it — never paper over it.

## 4. Ground truth every child MUST honor (no drift)

These are fixed by `../../../contracts/` and project hub `../../../_GLOBAL.md` §3.
Every child MUST mirror them exactly — same names, same sets, same rules:

- **Values** (`contracts/values.ts#ValueKind`): `null`, `boolean`, `number`
  (IEEE-754 double), `string`, `array` (mutable), `object` (insertion-ordered
  string-keyed map), `function` (closure), `builtin`.
- **Tokens/keywords** (`contracts/tokens.ts`): `KEYWORDS` = `let fn return if else
  while for break continue true false null`. Token set is the closed `TokenType`
  enum. Comments: `//` line and `/* … */` block (block comments do **not** nest).
- **Operators** (`contracts/ast.ts`): binary `+ - * / % == != < > <= >=`
  (`BinaryOperator`); logical short-circuit `&& ||` (`LogicalOperator`, kept
  distinct because they short-circuit); unary `- !` (`UnaryOperator`); assignment
  `=` is an **expression** (`AssignmentExpression`); postfix call `f(x)`, index
  `a[i]`, member `o.k`. `+` is also string concatenation (hub §3).
- **AST productions** (`contracts/ast.ts`): the `Expression` and `Statement`
  unions are the closed set of constructs the grammar MUST cover — no more, no
  fewer. `if` `else if` is an `IfStatement` whose `alternate` is itself an
  `IfStatement`; `for` has three optional clauses; object keys resolve to strings.
- **Truthiness** (hub §3): ONLY `null` and `false` are falsy; everything else
  (including `0` and `""`) is truthy.
- **Equality** (hub §3): `== !=` structural for primitives; arrays/objects/
  functions compare by **reference identity**.
- **Literals** (hub §3): decimal, hex, and exponent numbers; string escapes
  `\n \t \r \\ \" \0 \uXXXX`; array `[…]`; object `{ a: 1, "b": 2 }`.
- **Error model** (`contracts/errors.ts`): every diagnostic carries `ErrorCode`,
  `phase` (`lexical|syntax|runtime`), `span`, and (runtime only) a `stack`. Docs
  that reference errors MUST use the real `ErrorCode` members (e.g. `E3001`
  `UndefinedVariable`), never invented codes. Diagnostics render as the
  snippet+caret form shown in `contracts/errors.ts`.
- **Out-of-scope language features** (project hub §2, document as **intentional**
  design decisions, not omissions): bytecode/JIT, modules/imports, GC (rely on JS
  host GC), user-defined types/classes, async/concurrency, a Klein package
  manager, and a static type checker for Klein programs.

## 5. Toolchain facts children MUST use verbatim (from `tooling` COMPLETE.md + `package.json`)

- Package name **`klein`**, version **`0.1.0`**, `"type": "module"`, license
  **MIT**, `engines.node` **`>=18.18.0`**, `bin.klein` → `bin/klein.mjs`.
- Scripts (use these exact names in README): `build` (`tsc -p tsconfig.build.json`),
  `typecheck`, `lint` (`eslint .`), `lint:fix`, `format` (`prettier --write .`),
  `format:check` (`prettier --check .`), `test` (`vitest run`), `test:watch`,
  `coverage` (`vitest run --coverage`).
- The shipped CLI is run via **tsx** (or an esbuild bundle at publish); the `bin`
  target `bin/klein.mjs` is authored later by the `cli` task and need not exist yet.
  README MAY show `npx klein file.kl` / `klein` (REPL) as the intended UX but MUST
  NOT claim a build/run mechanism the scaffold hasn't proven. When unsure, describe
  the developer flow (`npm install`, then run via the project's runner) and defer
  install-from-npm specifics to the `cli`/publish stage — flag the deferral rather
  than confabulate.

## 6. Formatting (Prettier governs the delivered Markdown)

Per `tooling` COMPLETE.md §5 + `.prettierignore`: `README.md` and `docs/*.md`
**ARE** formatted by Prettier (only kernel-artifact markdown like `_GLOBAL.md` /
`_BRIEF.md` is ignored). `LICENSE` (no extension) and `CHANGELOG.md` are likewise
subject to `prettier --check .`. Style (`.prettierrc.json`): `printWidth 80`,
`tabWidth 2`, `semi true`, `singleQuote false`, `trailingComma all`, `endOfLine
lf`. **Author Markdown so `npm run format:check` passes** — wrap prose near 80
cols, use `lf`, and do not fight the formatter. The `synthesis` child verifies this.

## 7. Task structure & dependency DAG

Parallel authorship → grammar mirrors the finished precedence table → synthesis
verifies mutual consistency.

| Task (slug) | Responsibility (one kind of change) | Depends on | Owned output(s) — all at `../../../` |
|---|---|---|---|
| `SUBTASK_language` | Authoritative language-**semantics** specification | — | `docs/LANGUAGE.md` |
| `SUBTASK_grammar` | Formal **EBNF grammar** mirroring the AST + precedence | language | `docs/GRAMMAR.md` |
| `SUBTASK_project` | Project **onboarding/meta** docs | — | `README.md`, `LICENSE`, `CHANGELOG.md` |
| `SUBTASK_synthesis` | Cross-document **consistency verification** + `format:check` | language, grammar, project | *(own workspace only)* `SYNTHESIS.md` |

```
language ─┬─▶ grammar ─┐
project ──┴────────────┴─▶ synthesis
```

`grammar` depends on `language` so it mirrors the **finished, authoritative
operator-precedence table** and construct list rather than re-deriving it (removes
a whole class of drift). `project` is independent (it reads `package.json` + hub
§3 and links to the other docs). `synthesis` reads all three completed outputs.

Each child re-runs its **own** atomic-vs-decompose evaluation at dispatch. Each is
one cohesive document authored from fixed ground truth and is expected to be
atomic; if a child's own reading genuinely finds otherwise, that judgement is the
child's to make.

## 8. Ownership split (disjoint; exactly partitions `docs`'s owned outputs)

- **language** → `docs/LANGUAGE.md` only.
- **grammar** → `docs/GRAMMAR.md` only.
- **project** → `README.md`, `LICENSE`, `CHANGELOG.md` only.
- **synthesis** → writes NO project file; only its own workspace `SYNTHESIS.md`
  (plus it MAY read the outputs and run `npm run format:check`/`prettier --check`).

No two children write the same path; none writes under `src/`, `tests/`, tooling
config, or `contracts/`. `contracts/` is read-only for all.

## 9. Subtree success criteria (verified by `SUBTASK_synthesis`)

- [ ] Every document is internally consistent and consistent with `contracts/` +
      project hub §3: token/keyword names, `ErrorCode`s, operator set + precedence,
      truthiness rule, equality rule, literal forms all match — **zero drift**
      across LANGUAGE, GRAMMAR, README.
- [ ] `docs/GRAMMAR.md` EBNF covers **every** construct in hub §3 and **every** AST
      node in `contracts/ast.ts` — no orphan productions, no missing constructs.
- [ ] README install/usage commands match the real `package.json` scripts, `bin`,
      package name, and Node engine.
- [ ] Out-of-scope features (project hub §2) are documented as **intentional**
      design decisions in the appropriate doc(s), not silently omitted.
- [ ] `npm run format:check` passes on the delivered Markdown (and `LICENSE`).
- [ ] `contracts/` unmodified; no child wrote outside its ownership set.
