# COMPLETE — `grammar` (docs/GRAMMAR.md)

**Task**: Author the complete EBNF grammar for Klein, consistent with the AST
productions in `contracts/ast.ts` and the authoritative operator-precedence table
in `docs/LANGUAGE.md`.

**Decompose evaluation**: `Atomic`. One cohesive grammar document, one
responsibility, one owned output. Every decomposition trigger cleared and both
concern tests passed (lexical + syntactic sections are inseparable parts of one
internally-consistent grammar; splitting them would introduce the very drift the
subtree exists to prevent).

## Owned output produced (exclusive)

- `../../../docs/GRAMMAR.md` — the full EBNF grammar. Wrote nothing else.

## What the document contains

- **Notation legend** — a compact EBNF metasyntax table (`=`, `|`, `( )`, `[ ]`,
  `{ }`, terminals, non-terminals, comments) plus the two conventions that keep it
  faithful to the pipeline (terminals are tokens; whitespace/comments are
  discarded by the lexer and never appear in the syntactic grammar).
- **Lexical grammar** — token production, whitespace, both comment forms (block
  comments explicitly non-nesting), identifiers/keywords, number literals
  (decimal, exponent, hex), string literals with the exact escape set, and the
  full punctuation/operator terminal set (each annotated with its `TokenType`),
  plus the synthetic `EOF`.
- **Syntactic grammar** — `Program`; every statement (`let`, expression stmt,
  block, `if/else if/else`, `while`, C-style `for` with three optional clauses,
  `return`, `break`, `continue`, `fn` declaration); and expressions with
  precedence encoded **structurally** as a one-production-per-level cascade
  (assignment → logical or → logical and → equality → relational → additive →
  multiplicative → unary → postfix call/index/member → primary), including
  assignment-as-expression (right-assoc, with the assignment-target constraint
  noted), short-circuit `&& ||` as `LogicalExpression`, and primary literals
  (array, object, function literal, parenthesized grouping).
- **AST coverage tables** — an explicit production ↔ AST-node mapping for every
  `Expression` and `Statement` kind plus `Program`, making "no orphan productions,
  no missing constructs" auditable.
- **Worked examples** — the precedence examples mirrored from `LANGUAGE.md` and a
  short program exercising the statement grammar.

## Success criteria — status

- **Every AST node has a production; every production is a real construct.** Met.
  All 15 `Expression` kinds, all 10 `Statement` kinds, and `Program` are mapped in
  the AST-coverage tables; supporting types (`ObjectEntry`, `Parameter`,
  `AssignmentTarget`, the operator unions) are accounted for. No orphans.
- **Terminals match `contracts/tokens.ts` exactly.** Met. Keywords are exactly the
  `KEYWORDS` set; every `TokenType` punctuation/operator kind is represented and
  annotated with its enum member; `True`/`False`/`Null` handled as keyword-spelled
  literal tokens; `EOF` in `Program`.
- **Operator precedence/associativity matches `docs/LANGUAGE.md`.** Met. The nine
  levels, their operators, associativities, and node kinds mirror LANGUAGE.md's
  authoritative table verbatim, and the cascade encodes them structurally. The
  grammar states explicitly that if the two ever disagree, LANGUAGE.md governs.
- **Passes `npm run format:check` (Prettier).** Met and **verified**: ran the
  repo's local `prettier --check docs/GRAMMAR.md` (Prettier config from the
  scaffold; `printWidth 80`, `lf`) → "All matched files use Prettier code style!"
  after normalizing the two tables' column padding with `prettier --write` on this
  owned file.

## Consistency check (no drift) and discrepancies

Cross-checked `contracts/ast.ts` against `docs/LANGUAGE.md` and the ground-truth
in the hubs (§4 of the docs hub, §3 of the project hub). **No discrepancy found**
between LANGUAGE.md and ast.ts — the construct set, operator set, precedence, and
literal forms are mutually consistent, so there was nothing to flag under the
brief's discrepancy clause. The grammar mirrors both without deviation.

## Deferrals recorded (not invented, flagged in-document)

To honor "invent no new syntax," three genuinely-unfixed lexical/parser details
are marked as implementation-defined in the document rather than guessed, matching
LANGUAGE.md's deferral posture:

1. The precise identifier character class (the production gives the conventional
   ASCII form that covers all spec/example identifiers; exact classification is
   the lexer's).
2. Numeric-lexing edge cases beyond the three fixed forms.
3. Whether a trailing comma is tolerated in parameter/argument/array/object lists
   (grammar shows the strict, no-trailing-comma form).

These are noted for the `synthesis` child; none affects any construct the AST
fixes.

## Ownership / boundaries

- Wrote ONLY `docs/GRAMMAR.md`. Did not touch `docs/LANGUAGE.md`, `README.md`,
  `LICENSE`, `CHANGELOG.md`, `src/`, `tests/`, tooling config, or `contracts/`.
- `contracts/` read-only and unmodified. The `prettier --write` touched only the
  owned output file.
