# Task: Klein language specification (`docs/LANGUAGE.md`)

**Slug**: `language` · **Depends on**: — · **Dependents**: `grammar`, `synthesis`.

## Objective
Author the authoritative, human-readable specification of Klein's **semantics** —
the narrative expansion of project hub §3 and `contracts/`, inventing no new
behavior.

## Context
Part of the Klein `docs` subtree (see `../_GLOBAL.md`). You write the single
document that every other doc (and every reader) treats as the semantic authority.
You define behavior that `contracts/` and the project hub already fix; you are the
authoritative expansion, not the inventor of semantics. Do not contradict
`../../../_GLOBAL.md` §3 or `../../../contracts/`.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree ground truth (§4), out-of-scope list, success criteria.
- `../../../_GLOBAL.md` — §3 authoritative language summary you expand, §2 scope
  (in/out incl. intentional debt).
- `../../../contracts/` — **read-only**, cite for accuracy:
  - `tokens.ts` — `TokenType`, `KEYWORDS`, literal/comment vocabulary.
  - `ast.ts` — the exact operator sets (`UnaryOperator`, `BinaryOperator`,
    `LogicalOperator`), assignment-as-expression, and every construct.
  - `values.ts` — `ValueKind`, `Environment` (scope/`define`/`get`/`assign`),
    closures, builtin calling convention.
  - `errors.ts` — the `ErrorCode` catalogue and diagnostic shape.

## Owned output (exclusive — write ONLY this)
- `../../../docs/LANGUAGE.md` — the full language spec. Cover at least: values &
  their semantics; `let` bindings, lexical block scope, shadowing; assignment as an
  expression; the **operator set with an authoritative precedence/associativity
  table** (this table is the source `grammar` will mirror — make it complete and
  unambiguous); control flow (`if/else if/else`, `while`, C-style `for`, `break`,
  `continue`); functions/closures (`fn` decls & expressions, first-class, `return`,
  lexical capture); **truthiness** (only `null`/`false` falsy); **equality**
  (structural for primitives, reference identity for arrays/objects/functions);
  comments; literals (number forms incl. hex/exponent, string escapes, array,
  object); and the **error model** (reference real `ErrorCode`s by phase). Document
  the project-hub §2 out-of-scope features as **intentional** design decisions.

Write NOTHING else — not `README.md`, `docs/GRAMMAR.md`, `LICENSE`, `CHANGELOG.md`,
`src/`, `tests/`, or `contracts/`.

## Success criteria
- Every value kind, operator, keyword, literal form, and `ErrorCode` you mention
  matches `contracts/` exactly (no invented names/codes; no drift from hub §3).
- The operator precedence/associativity table is complete and unambiguous (covers
  every operator in `ast.ts`), suitable for `grammar` to mirror verbatim.
- Truthiness and equality rules are stated precisely and match hub §3.
- Out-of-scope features appear as explicit intentional decisions, not omissions.
- Authored to pass `npm run format:check` (Prettier; see `../_GLOBAL.md` §6).

## Constraints
- Documentation only — introduce NO runtime behavior; invent NO semantics beyond
  hub §3 + contracts. If you find a genuine gap or contradiction, document it
  explicitly and flag it in your `COMPLETE.md` rather than guessing.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. This is one cohesive
spec document with one responsibility (specify the semantics) and heavy internal
cross-referencing; it is expected to be atomic, but that judgement is yours.
