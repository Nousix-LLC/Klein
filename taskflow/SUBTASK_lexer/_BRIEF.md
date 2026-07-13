# Task: Lexer (source → Token[])

**Slug**: `lexer` · **Depends on**: `scaffold` · **Dependents**: `parser`

## Objective
Implement an error-tolerant lexer that turns Klein source text into the token
stream defined by the contract, with precise spans and pre-decoded literals.

## Context
Part of **Klein** (see `../_GLOBAL.md` §3–§4). You implement the `Lexer`
interface from `../contracts/pipeline.ts`, emitting `Token`s per
`../contracts/tokens.ts`. The scaffold's `src/core/` gives you Span helpers and
the `LexicalError` class — import them; do not reimplement.

## Inputs (read at start)
- `../_GLOBAL.md`, `../contracts/tokens.ts`, `../contracts/pipeline.ts`, `../contracts/errors.ts`
- `../src/core/**` (real, completed) — Span helpers + `LexicalError`.
- `../docs/LANGUAGE.md` — authoritative lexical rules (numbers, strings, escapes, comments).

## Approach (single responsibility: scanning)
Constructed with `(source, sourceName)`; `tokenize()` returns `{ tokens, errors }`
with exactly one trailing `EOF`. Decode literal payloads once (number value incl.
hex/exponent; string value with escapes `\n \t \r \\ \" \0 \uXXXX`). Recognize
keywords via `KEYWORDS`. Track line/column for every span. Be error-tolerant:
on `UnexpectedCharacter`, `UnterminatedString`, `InvalidEscape`, `InvalidNumber`,
`UnterminatedComment`, record a `LexicalError` (correct `ErrorCode`) and continue.
Handle `//` and non-nesting `/* */` comments (as trivia, not tokens).

## Owned outputs
`src/lexer/**` (implementation + `index.ts` barrel), `tests/lexer/**`. Nothing else.

## Success criteria
- Implements `contracts/pipeline.ts#Lexer`; `tsc`, ESLint, Prettier clean.
- Unit tests cover every `TokenType`, span accuracy (line/column at newlines),
  every escape, hex/exponent numbers, each lexical `ErrorCode`, and error
  recovery (multiple errors in one source). Tests assert on `ErrorCode`, not text.
- ≥90% line coverage of `src/lexer`.

## Constraints
- Import contract + `src/core`; never edit `contracts/`. No `any` in public surface.
- Column counting per `Position` contract (UTF-16 code units).
