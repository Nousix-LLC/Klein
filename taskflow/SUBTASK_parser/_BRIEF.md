# Task: Parser (Token[] → AST)

**Slug**: `parser` · **Depends on**: `scaffold`, `lexer` · **Dependents**: `runtime`

## Objective
Implement a recovering Pratt (precedence-climbing) parser that turns the token
stream into the AST defined by the contract, reporting multiple syntax errors
per pass.

## Context
Part of **Klein** (see `../_GLOBAL.md` §3–§4). You implement
`../contracts/pipeline.ts#Parser`, producing nodes exactly per
`../contracts/ast.ts`. Use the **real** lexer (`../src/lexer/`) in your tests to
parse real source. Import `SyntaxErr` from `../src/core`.

## Inputs (read at start)
- `../_GLOBAL.md`, `../contracts/ast.ts`, `../contracts/tokens.ts`, `../contracts/pipeline.ts`, `../contracts/errors.ts`
- `../src/lexer/**` and `../src/core/**` (real, completed).
- `../docs/GRAMMAR.md` — the authoritative EBNF you implement.

## Approach (single responsibility: parsing)
Constructed with `(tokens, sourceName)`; `parse()` returns `{ program, errors }`.
Pratt expression parsing with the precedence ladder: assignment (lowest,
right-assoc) < `||` < `&&` < equality < comparison < additive < multiplicative <
unary < call/index/member (highest). Statements: `let`, expression stmt, block,
`if/else if/else`, `while`, C-style `for`, `return`, `break`, `continue`,
`fn` declaration. Validate assignment targets (`InvalidAssignmentTarget`) and
duplicate params (`DuplicateParameter`). On error, record a `SyntaxErr` with the
right `ErrorCode` and **synchronize** to the next statement boundary so parsing
continues. Every node carries an accurate `span`.

## Owned outputs
`src/parser/**` (parser + precedence table + `index.ts`), `tests/parser/**`.

## Success criteria
- Implements `contracts/pipeline.ts#Parser`; produces contract-exact nodes; `tsc`/lint/format clean.
- Tests: precedence & associativity, every statement/expression form, object/array
  literals, call/index/member chains, `else if` nesting, error recovery producing
  multiple `ErrorCode`s, span accuracy. Assert on `ErrorCode`, not text. ≥90% coverage.

## Constraints
- Import contract + `src/core` + `src/lexer`; never edit `contracts/`. No `any` in public surface.
- If a construct in `docs/GRAMMAR.md` is ambiguous, resolve per the grammar and note it; do not invent syntax beyond `_GLOBAL.md` §3.
