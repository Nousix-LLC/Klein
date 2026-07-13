# COMPLETE — `SUBTASK_parser` (Token[] → AST)

**Task**: Implement Klein's recovering Pratt parser per `contracts/pipeline.ts#Parser`.
**Decompose evaluation**: `Atomic` (parsing is one cohesive, mutually-recursive
responsibility — see the evaluation record below). **Result**: completed.

## What was built

A production-grade, error-tolerant parser that turns the lexer's `Token[]` into
the exact AST fixed by `contracts/ast.ts`, plus a full test suite.

### Owned outputs (all within `src/parser/**`, `tests/parser/**`)

| File | Role |
|---|---|
| `src/parser/parser.ts` | The `Parser` class implementing `contracts/pipeline.ts#Parser`; statements, the Pratt/precedence-climbing expression engine, postfix chains, and error recovery. |
| `src/parser/precedence.ts` | The declarative infix precedence table (`INFIX_OPERATORS`, `PRECEDENCE`, `LOWEST_INFIX_PRECEDENCE`) — the data half of the Pratt parser. |
| `src/parser/index.ts` | Public barrel (`export { Parser }`). |
| `tests/parser/helpers.ts` | Shared lex-then-parse helpers (drive the **real** `src/lexer`). |
| `tests/parser/expressions.test.ts` | Precedence/associativity ladder, unary, postfix chains, literals, array/object/function literals, grouping, assignment. |
| `tests/parser/statements.test.ts` | Every statement form; `else if` nesting; C-style `for` clause optionality; declarations. |
| `tests/parser/recovery.test.ts` | Multi-error recovery; every syntax `ErrorCode`; local recovery of invalid-target & duplicate-param. |
| `tests/parser/spans.test.ts` | Span accuracy (offsets, line/column, `nameSpan`/`keySpan`/`propertySpan`). |

## How it composes with the contract

- Constructed `(tokens, sourceName)`; `parse()` returns `{ program, errors }`
  (`ParseResult`). `program` is always returned, partial when `errors` is non-empty.
- Produces **contract-exact** nodes discriminated by `kind`, every node carrying an
  accurate half-open `span`. Imports `SyntaxErr`, `makeSpan`, `mergeSpans` from
  `src/core` (via `@core`); token/AST/error vocabulary literally from `@contracts`.
- **Precedence ladder** (loosest→tightest), matching `docs/LANGUAGE.md` (authoritative)
  and `docs/GRAMMAR.md`: assignment (right-assoc) < `||` < `&&` < equality <
  relational < additive < multiplicative < unary (prefix) < call/index/member.
- **Error recovery**: on a hard fault the parser records a `SyntaxErr` with the right
  `ErrorCode` and **synchronizes** to the next statement boundary, so one pass surfaces
  many errors. `InvalidAssignmentTarget` and `DuplicateParameter` recover *locally*
  without discarding the surrounding statement. Assignment targets are validated
  (`InvalidAssignmentTarget`); duplicate params are rejected (`DuplicateParameter`).

## Design decisions worth flagging to downstream consumers

- **Statement/expression ambiguity resolved per the grammar**: at *statement* position
  a leading `{` is a **block** and a leading `fn` is a **declaration**; object and
  anonymous-function *literals* therefore only appear in *expression* position (e.g. a
  `let` initializer, an argument, `( … )`). The `runtime` task consumes the AST, so
  this only matters if a future test writes a bare `{a:1};` — that is a block by design.
- **Parentheses build no node** (per `docs/GRAMMAR.md`): a parenthesized expression
  keeps its inner span; there is no `Grouping` AST node (none exists in the contract).
- **Guaranteed-progress recovery**: the top-level and block loops advance at least one
  token whenever an error leaves the cursor stationary, so no input can spin the parser
  (a hardened fix for stray `}` / leading-delimiter inputs).

## Verification (all green)

- `tsc -p tsconfig.json --noEmit` — 0 errors (strict; no `any` in public surface).
- `eslint src/parser tests/parser` — 0 problems.
- `prettier --check` on all owned files — clean.
- `vitest run` (whole repo) — **230 tests pass** across 9 files.
- Coverage (whole repo): **99.15% lines / 97.58% branch / 100% funcs**; the parser
  subtree is **98.18% lines / 96.38% branch / 100% funcs**, comfortably ≥ the 90% bar.
  The few uncovered parser lines are defensive, unreachable guards (an out-of-range
  token read and non-`ParseErrorSignal` re-throws).
- `contracts/` unmodified; no writes outside `src/parser/**` and `tests/parser/**`.

## Handoff to `runtime` (dependent)

`runtime` depends on this task. It should construct `new Parser(tokens, sourceName)`
from `src/parser` and consume `ParseResult.program` (a `Program` of contract AST
nodes) and `ParseResult.errors`. Every node's `span` is populated for diagnostics;
`IfStatement.alternate` encodes `else if` as a nested `IfStatement`; `for` clauses
(`init`/`condition`/`update`) are independently nullable.
