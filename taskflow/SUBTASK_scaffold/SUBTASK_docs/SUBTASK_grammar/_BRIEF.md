# Task: Klein formal grammar (`docs/GRAMMAR.md`)

**Slug**: `grammar` · **Depends on**: `language` · **Dependents**: `synthesis`.

## Objective
Author the complete **EBNF grammar** for Klein, consistent with the AST productions
in `contracts/ast.ts` and with the authoritative operator-precedence table in
`docs/LANGUAGE.md`.

## Context
Part of the Klein `docs` subtree (see `../_GLOBAL.md`). You depend on `language` so
you can mirror its **finished, authoritative precedence/associativity table** and
construct list rather than re-deriving them — this is the anti-drift reason for the
dependency. The grammar describes surface syntax; it must exactly cover the
constructs the parser will build (`contracts/ast.ts`). Do not invent syntax the AST
cannot represent, and do not omit any construct the AST defines.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree ground truth (§4) and success criteria (§9).
- `../../../_GLOBAL.md` §3 — the authoritative language summary.
- `../../../contracts/tokens.ts` — terminal vocabulary (`TokenType`, `KEYWORDS`,
  literal/comment forms) your grammar's terminals must match.
- `../../../contracts/ast.ts` — every `Expression`/`Statement`/`Program`
  production your grammar must generate (and no others).
- `../../../docs/LANGUAGE.md` (dependency output) — mirror its operator
  precedence/associativity table and construct semantics for consistency.

## Owned output (exclusive — write ONLY this)
- `../../../docs/GRAMMAR.md` — the full EBNF. Include: a short notation legend;
  lexical grammar (tokens: identifiers, keywords, number forms incl. hex/exponent,
  string literals + escapes, comments incl. non-nesting block comments,
  punctuation/operators); and the syntactic grammar for every construct — program,
  statements (`let`, expression stmt, block, `if/else if/else`, `while`, C-style
  `for` with three optional clauses, `return`, `break`, `continue`, `fn` decl), and
  expressions with **precedence encoded structurally** (matching `LANGUAGE.md`'s
  table), including assignment-as-expression, logical `&& ||`, comparisons,
  additive/multiplicative, unary `- !`, postfix call/index/member, and primary
  literals (array, object, function expression, grouping).

Write NOTHING else — not `docs/LANGUAGE.md`, `README.md`, `LICENSE`, `CHANGELOG.md`,
`src/`, `tests/`, or `contracts/`.

## Success criteria
- Every AST node in `contracts/ast.ts` has a corresponding production; every
  production corresponds to a real construct — **no orphan productions, no missing
  constructs**.
- Terminals match `contracts/tokens.ts` exactly (token/keyword names, literal and
  comment forms).
- Operator precedence/associativity encoded in the grammar matches
  `docs/LANGUAGE.md`'s authoritative table (no divergence).
- Authored to pass `npm run format:check` (Prettier; see `../_GLOBAL.md` §6).

## Constraints
- Documentation only — describe syntax the AST/contracts already fix; invent no new
  syntax. If `LANGUAGE.md` and `ast.ts` appear to disagree, do NOT silently pick
  one — document the discrepancy and flag it in your `COMPLETE.md`.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. One cohesive grammar
document, one responsibility; expected atomic, but the judgement is yours.
