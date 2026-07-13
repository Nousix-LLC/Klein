# COMPLETE — `SUBTASK_language` (Klein language-semantics spec)

**Task**: Author `docs/LANGUAGE.md`, the authoritative narrative expansion of the
Klein semantics fixed by the project hub §3 and `contracts/`, inventing no new
behavior.
**Decompose evaluation**: `Atomic` (one cohesive spec document, one
responsibility — specify the semantics; tiny token load; ~1 write). Every trigger
family and both concern tests were applied at dispatch and cleared/passed; the
Output-Size signal is the weakest and does not override the passing concern tests
for a single authored reference document whose entire value is drift-free
coherence.
**Status**: COMPLETE.

## Owned output produced (exclusive)

- `../../../docs/LANGUAGE.md` — the full Klein language specification (938 lines).

Wrote **nothing else**. No `README.md`, `docs/GRAMMAR.md`, `LICENSE`,
`CHANGELOG.md`, `src/`, `tests/`, or `contracts/` was created or modified.
`contracts/` remains read-only and untouched.

## What the document covers

Values & their semantics (all 8 `ValueKind`s); `let` bindings, lexical block
scope, shadowing; assignment-as-expression (right-assoc, target restricted to the
three `AssignmentTarget` forms, and the "assignment does not create a binding"
rule from `Environment.assign`); the **authoritative operator
precedence/associativity table** (levels 1–9, every operator in `ast.ts`:
assignment, `||`, `&&`, equality, relational, additive, multiplicative, unary,
postfix call/index/member) — this is the table `grammar` will mirror verbatim;
control flow (`if`/`else if`/`else` as nested `IfStatement`, `while`, C-style
`for` with three optional clauses, `break`, `continue`); functions & closures
(`FunctionDeclaration` vs `FunctionLiteral`, first-class, `return`, lexical
capture, hoisted-by-value recursion, `maxCallDepth`/`StackOverflow`);
**truthiness** (only `null`/`false` falsy); **equality** (structural for
primitives incl. IEEE `NaN != NaN`, reference identity for
array/object/function/builtin, different kinds never equal, never throws);
comments; literals (decimal/hex/exponent numbers, string escapes incl. `\uXXXX`,
array, object with identifier-or-string keys); and the **error model** (three
phases, diagnostic shape with span + runtime stack, snippet+caret rendering, and
a full table of every `ErrorCode`).

## Fidelity to `contracts/` + hub §3 (anti-drift)

- **ErrorCodes**: verified mechanically — every code cited in the doc exists in
  `contracts/errors.ts` (0 invented) AND all 23 codes (`E1001`–`E1005`,
  `E2001`–`E2005`, `E3001`–`E3013`) are documented (0 orphans).
- **Values**: the 8 `ValueKind` members and their names match `values.ts`
  exactly; mutability/comparison columns follow the contract
  (`ArrayValue`/`ObjectValue` mutable, `Map`-backed insertion order).
- **Operators / AST**: operator set matches `ast.ts` `UnaryOperator` /
  `BinaryOperator` / `LogicalOperator` / `AssignmentExpression` and the postfix
  forms; logical `&&`/`||` documented as short-circuit (their reason for being a
  distinct node). Precedence table covers every operator with no additions.
- **Keywords / comments / literals**: keyword list and no-nesting block-comment
  rule match `tokens.ts` + hub §3.
- **Truthiness & equality**: stated verbatim to hub §3.
- **Out-of-scope features**: project-hub §2 non-goals documented as an explicit
  **Intentional non-goals** section with rationale, not omissions.
- **Formatting**: `prettier --write` applied to the owned file; `prettier --check
  docs/LANGUAGE.md` returns exit 0 (`npm run format:check` will pass on this
  file). (Node was resolved from nvm at
  `~/.nvm/versions/node/v24.18.0`; it is not on the bare PATH — noted for any
  downstream task that shells out to the toolchain.)

## Genuine gaps / underspecified points (flagged, NOT guessed)

Per the brief constraint, points that the hub §3 + `contracts/` do **not** fix are
documented explicitly in the spec's **"Deferred and implementation-defined
details"** section rather than invented. They are runtime-owned and do not affect
the fixed core semantics:

1. **Ordered comparison of non-numbers.** `< > <= >=` are fixed on numbers;
   whether they also order strings (lexicographic) or others is not fixed by the
   contracts. Left to `runtime`; unsupported operands raise a runtime error.
2. **Bad-operand code selection.** Which of `TypeMismatch` (`E3002`) /
   `InvalidOperand` (`E3010`) a given wrong-kind operand raises is a runtime
   decision; the codes/meanings are fixed, the per-situation assignment is not.
3. **Absent object key via `[...]` vs `.`.** `o.k` on a missing key is
   `PropertyNotFound` (`E3008`); whether `o["k"]` on a missing key behaves
   identically or yields `null` is implementation-defined.
4. **String indexing `s[i]`.** Not fixed by the contracts; string element/length
   access may be a stdlib concern instead.
5. **`break`/`continue` outside a loop; same-scope `let` redeclaration.** Whether
   rejected at parse or runtime, and with which code, is an implementation
   detail; the language rule (both are only meaningful within a loop / a redeclare
   introduces a fresh binding) is stated.

**No contradictions** were found between `contracts/` and hub §3; they are
mutually consistent. These deferred items are genuine specification openness, not
drift — `grammar` and `synthesis` should treat them as intentionally open.

## Handoff to dependents

- **`grammar`** (`docs/GRAMMAR.md`): mirror the **§ Operators, precedence, and
  associativity** table verbatim — levels 1 (assignment, right-assoc) → 9
  (postfix call/index/member) → primary — and cover exactly the `Expression` and
  `Statement` unions in `ast.ts` (no orphan productions, no missing constructs).
- **`synthesis`**: this file passes `prettier --check`; cross-doc consistency
  anchors are the ErrorCode table, the precedence table, and the truthiness /
  equality statements.
