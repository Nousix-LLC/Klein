# COMPLETE — SUBTASK_lexer (source → Token[])

**Task**: `lexer` · **Depends on**: `scaffold` · **Dependents**: `parser`
**Decompose evaluation**: `Atomic` (single responsibility: scanning)
**Status**: COMPLETED

## What was built

An error-tolerant lexer for Klein that turns source text into the `Token[]`
stream fixed by the contract, with precise spans and pre-decoded literal payloads.
It implements `contracts/pipeline.ts#Lexer` (`tokenize(): LexResult`) and is
constructed with `(source, sourceName = "<script>")`.

## Owned outputs (nothing outside `src/lexer/**`, `tests/lexer/**`)

| File | Role |
|---|---|
| `src/lexer/lexer.ts` | The `Lexer` class: cursor with offset/line/column bookkeeping, trivia skipping, token dispatch, number/string/identifier scanners, error collection. |
| `src/lexer/char.ts` | Pure, total character-class predicates (`isDigit`, `isHexDigit`, `isAlpha`, `isAlphaNum`) — ASCII by design, `false` on `""` (past-EOF). |
| `src/lexer/index.ts` | Public barrel: `export { Lexer } from "./lexer"`. Downstream: `import { Lexer } from "../lexer"`. |
| `tests/lexer/lexer.test.ts` | 108 cases: every `TokenType`, span/line/column accuracy across newlines & astral chars, every escape, all three number forms, each lexical `ErrorCode`, and multi-error recovery. |
| `tests/lexer/char.test.ts` | Direct predicate tests (both hex letter cases, underscore, empty-string). |

## Contract compliance

- **Imports, never paraphrases contracts.** `TokenType`, `KEYWORDS`, `Token`,
  `Position`, `LexResult`, `ErrorCode`, and the `Lexer` interface come from
  `@contracts`; the `Span`/`Position` helpers and the concrete `LexicalError`
  class come from `@core` (scaffold-owned `src/core/`) — none reimplemented.
- **`contracts/` unmodified.** No writes outside the two owned subtrees.
- Token stream always terminates with exactly one synthetic `EOF`.
- Literal payload present iff `type ∈ {Number, String}` (per the `Token` contract);
  keyword-spelled literals `true`/`false`/`null` carry no `value`.
- `column` counts UTF-16 code units (verified through an astral character), per
  the `Position` contract.

## Key scanning decisions (from `docs/LANGUAGE.md`)

- **Numbers:** decimal (incl. leading-dot `.5`), exponent (`e`/`E`, optional sign),
  and `0x` hex; decoded once via `Number(lexeme)`. A literal butted against
  identifier chars (`123abc`, `1_000`) or a malformed exponent/`0x` → `InvalidNumber`.
  `1.foo` correctly splits into `Number · Dot · Identifier`.
- **Strings:** escapes `\n \t \r \\ \" \0 \uXXXX` decoded; `\uXXXX` requires 4 hex.
- **Comments:** `//` line and non-nesting `/* */` block are trivia (verified: the
  first `*/` closes; a lone unclosed block → `UnterminatedComment`).
- **Error-recovery policy (uniform, documented in `lexer.ts`):** a lexeme that
  cannot form a valid token (`UnexpectedCharacter`, `UnterminatedString`,
  `InvalidNumber`) → diagnostic + *no* token; a structurally-valid token with a
  local fault (`InvalidEscape` in a closed string) → diagnostic + recovered token.
  Scanning always continues, so one run surfaces many errors.

## Verification (run at `interpreter/` with Node on PATH)

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc` strict) | ✅ zero errors |
| `npm run lint` (`eslint .`) | ✅ clean (no `any`, no warnings) |
| `npm run format:check` (`prettier --check .`) | ✅ clean |
| `vitest run` | ✅ 154 passed (116 lexer + 38 pre-existing core) |
| Coverage on `src/lexer` | ✅ 100% lines / 100% branch / 100% funcs (bar: ≥90%) |

## Handoff to `parser`

Construct and drive:

```ts
import { Lexer } from "../lexer";
const { tokens, errors } = new Lexer(source, sourceName).tokenize();
```

`tokens` is `readonly Token[]` ending in one `EOF`; `errors` is
`readonly KleinError[]` (concrete `LexicalError`s). Even on lexical errors a
usable, `EOF`-terminated stream is returned, so the parser can proceed and
surface its own diagnostics alongside the lexer's.

## Methodology note

The engine's software methodology bundle was unreachable this invocation
(`agent_domain_unset` from `methodology_glob`/`load_methodology`) — the same gap
recorded in `_GLOBAL.md` §8. The work was driven by the contracts, the hub, this
brief, and `docs/LANGUAGE.md`; it follows standard, well-trodden lexer
construction and contradicts none of it.
