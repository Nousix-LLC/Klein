# Klein — a production-grade interpreter for a small dynamic language

**Subtree hub (`_GLOBAL.md`).** Shared, write-once context for every task in this
decomposition. Read this plus your own `SUBTASK_*/_BRIEF.md`, and treat
`contracts/` as read-only ground truth.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Root request**: verbatim below.

> Build a real, production-ready interpreter for a small dynamic programming
> language in TypeScript/Node. This should be high quality code ready for
> production at google/meta, not a toy project for an interview.

---

## 1. Objective & quality bar

Deliver **Klein**, a small but genuinely usable dynamically-typed language, with a
tree-walking interpreter implemented in TypeScript for Node.js. "Production
quality at Google/Meta" is the bar, operationalized as:

- **Strict, typed, lint-clean.** `tsc` strict mode, ESLint, Prettier — all green.
  No `any` in public surface. ESM (`NodeNext`).
- **Correct & well-tested.** Unit tests per stage + end-to-end tests; ≥90% line
  coverage on `src/`. Tests key off structured `ErrorCode`s, not message text.
- **Excellent diagnostics.** Every error (lexical/syntax/runtime) is
  source-anchored with line/column, a rendered snippet + caret, and — for runtime
  errors — a call stack. This is a first-class product feature, not an afterthought.
- **Real UX.** A CLI that runs `.kl` files and a usable REPL (multiline, readable
  errors). Published as an npm package with a `bin`.
- **Documented.** README, a full language specification, and an EBNF grammar.

Non-negotiable engineering posture (from the consulting persona): the *boring*
choice is the courageous one. This is a **tree-walking** interpreter (not a
bytecode VM) because the language is small and clarity/maintainability win; every
abstraction must earn its place; simplicity is defended actively.

## 2. Scope

**In scope:** lexer, Pratt parser, tree-walking evaluator with lexical closures,
a small standard library of builtins, a CLI + REPL, full tooling, tests, docs,
and example programs.

**Out of scope (documented as intentional debt, not omissions):** bytecode/JIT
compilation, a module/import system, a garbage collector (we rely on the JS
host GC), user-defined types/classes, async/concurrency, a package manager for
Klein, and a static type checker for Klein programs.

## 3. The Klein language (authoritative summary; full spec in `docs/LANGUAGE.md`)

- **Values:** `null`, booleans, numbers (IEEE-754 double), strings, arrays,
  objects (string-keyed, insertion-ordered maps), functions (closures), builtins.
- **Bindings:** `let x = expr;`; assignment `x = expr` is an expression. Lexical
  block scope; inner `let` shadows.
- **Operators:** `+ - * / %` (with `+` also string concatenation), comparisons
  `< > <= >= == !=`, logical `&& || !` (short-circuit), unary `-`/`!`, indexing
  `a[i]`, member `o.k`, call `f(x)`.
- **Control flow:** `if/else if/else`, `while`, C-style `for(init; cond; upd)`,
  `break`, `continue`.
- **Functions:** `fn name(a,b){…}` declarations and `fn(a,b){…}` expressions;
  first-class, close over their defining scope; `return`.
- **Truthiness:** ONLY `null` and `false` are falsy (everything else — including
  `0` and `""` — is truthy). Predictable and documented.
- **Equality:** `==`/`!=` are structural for primitives; arrays/objects/functions
  compare by reference identity. Documented.
- **Comments:** `//` line and `/* … */` block (block comments do not nest).
- **Literals:** decimal & hex & exponent numbers; strings with escapes
  `\n \t \r \\ \" \0 \uXXXX`; array `[…]`; object `{ a: 1, "b": 2 }`.

Concrete, worked example programs live in `examples/` (owned by `integration`).

## 4. Architecture

A classic, boring, correct pipeline — each stage a separable specialty composing
against `contracts/`:

```
source ──▶ Lexer ──▶ Token[] ──▶ Parser ──▶ AST(Program) ──▶ Interpreter ──▶ Value
                                                              ▲
                                              stdlib builtins ┘   (installed into globals)
                                CLI/REPL drives the whole pipeline via interpret()
```

- **Error tolerance:** lexer and parser *collect* diagnostics and recover, so a
  user sees many errors per run. The interpreter throws on the first runtime
  fault (with a stack), which the facade catches and reports.
- **Shared core:** `src/core/` (owned by `scaffold`) holds Span helpers, the
  concrete error classes implementing `contracts/errors.ts#KleinError`, and the
  diagnostic renderer. Every stage imports these — do not reimplement them.

## 5. The contract layer (`contracts/`) — READ-ONLY

`contracts/` is the machine-verifiable compositional schema. It is the
`interfaces/` crate of this project; `_GLOBAL.md` (this file) is the README.
Descendant tasks **import** these declarations literally — never paraphrase them
into component source, never edit `contracts/`. If a contract is inadequate,
request an *additive* plan amendment; do not deviate silently.

| File | Fixes |
|---|---|
| `contracts/tokens.ts` | `Position`, `Span`, `TokenType`, `KEYWORDS`, `Token` |
| `contracts/ast.ts` | Every AST node; `Expression`/`Statement`/`Program` unions |
| `contracts/values.ts` | `Value` union, `Environment`, builtin calling convention, `Interpreter` |
| `contracts/errors.ts` | `ErrorCode`, `Diagnostic`, `KleinError`, `DiagnosticFormatter` |
| `contracts/pipeline.ts` | `Lexer`/`Parser` stage interfaces, `interpret()` result types |
| `contracts/_MANIFEST.yaml` | Ownership + integration identities |

Import convention: scaffold wires a `@contracts` path alias, so components write
`import { Token } from "@contracts"`. A relative import to `contracts/` is
equally valid; both resolve to the same read-only files.

## 6. Task structure & dependency DAG

A mostly-serial pipeline (the kernel's precursor → transform → synthesis shape).
Serial dependencies are deliberate: each stage gets the **real, completed**
upstream implementation to integrate and test against, maximizing correctness.
Each child re-runs its own atomic-vs-decompose evaluation; several (parser,
runtime) may legitimately decompose further.

| Task (slug) | Responsibility | Depends on | Key owned outputs |
|---|---|---|---|
| `SUBTASK_scaffold` | Tooling, config, docs, shared `src/core/` | — | package.json, tsconfig, eslint, docs/, src/core/ |
| `SUBTASK_lexer` | Source → `Token[]` (error-tolerant) | scaffold | src/lexer/, tests/lexer/ |
| `SUBTASK_parser` | `Token[]` → AST (Pratt, recovering) | scaffold, lexer | src/parser/, tests/parser/ |
| `SUBTASK_runtime` | AST → `Value` (env, closures, control flow) | scaffold, parser | src/runtime/, tests/runtime/ |
| `SUBTASK_stdlib` | Builtin functions + registry | runtime | src/stdlib/, tests/stdlib/ |
| `SUBTASK_cli` | `interpret()` facade, CLI, REPL, `bin` | stdlib | src/index.ts, src/cli/, bin/, tests/cli/ |
| `SUBTASK_integration` | Examples, E2E/golden tests, integrity verification | cli | examples/, tests/integration/, tests/errors/ |

```
scaffold ─▶ lexer ─▶ parser ─▶ runtime ─▶ stdlib ─▶ cli ─▶ integration
```

`integration` is the synthesis hub: it wires nothing new of substance but proves
the whole composes — it runs the `_MANIFEST.yaml` identities (tsc, eslint,
prettier, vitest, coverage, ownership, examples) and fails loudly on any miss
(no silent plugs).

## 7. Cross-cutting conventions (binding on all tasks)

- **Language/runtime:** TypeScript strict; ESM `NodeNext`; Node ≥ 18; test runner
  **Vitest**; lint **ESLint** (typescript-eslint) + **Prettier**. (Scaffold fixes
  exact versions in package.json; downstream tasks use them, not alternatives.)
- **No `any`** in exported signatures; prefer discriminated unions + exhaustive
  `switch` with a `never` assertion in the default arm.
- **Determinism:** object key order is insertion order (hence `Map` for objects);
  number formatting is fixed and documented (integers print without a trailing
  `.0`; the renderer is owned by `runtime`'s value-stringifier).
- **Errors carry spans always.** No error is thrown without a `Span`.
- **Files:** one responsibility per module; each task exposes a barrel
  `index.ts` for its subtree.
- **Tests key off `ErrorCode`**, never on human-readable message text.

## 8. Methodology posture & known gap

The engine's **software methodology bundle was unavailable** to the root agent
(`agent_domain_unset` from `methodology_glob`/`load_methodology`). This
decomposition therefore encodes methodology directly in the contracts + this hub
+ each brief, per the kernel's guidance to document gaps rather than confabulate.
If a downstream task is dispatched with the methodology bundle available, it
SHOULD load it and reconcile; nothing here should contradict standard
interpreter-construction methodology (it deliberately follows the well-trodden
Pratt-parser / tree-walker approach).

## 9. Success criteria (project-level)

- [ ] `npm run build` (tsc) — zero errors, strict mode.
- [ ] `npm run lint` + `npm run format:check` — clean.
- [ ] `npm test` — all stage + integration tests green; ≥90% line coverage on src/.
- [ ] `klein examples/fibonacci.kl` (and every example) produces its golden output.
- [ ] `klein` with no args starts a working REPL.
- [ ] Every error path yields a source-anchored, snippet-rendered diagnostic.
- [ ] `contracts/` unmodified since root authorship; ownership manifest respected.
- [ ] README + `docs/LANGUAGE.md` + `docs/GRAMMAR.md` complete and accurate.
