/**
 * The parser's infix operator precedence table — the data half of the Pratt
 * (precedence-climbing) expression parser.
 *
 * The table maps each infix `TokenType` to its binding power, its associativity
 * (encoded structurally by how the climbing loop recurses — see `parser.ts`), and
 * the AST node kind it builds. It is the single, declarative source of truth for
 * the binary/logical band of the precedence ladder; `parser.ts` reads it and owns
 * no per-operator precedence knowledge of its own.
 *
 * The precedence numbers mirror the authoritative table in
 * `docs/LANGUAGE.md` §"Operators, precedence, and associativity" (which governs
 * `docs/GRAMMAR.md`): higher number = binds tighter. Only the band handled by the
 * climbing loop lives here — assignment (level 1, right-associative) and the
 * prefix-unary / postfix levels (8–9) are parsed by dedicated methods in
 * `parser.ts`, so they are intentionally absent from this table.
 *
 *    level 2  ||              (logical, short-circuits)
 *   level 3  &&              (logical, short-circuits)
 *   level 4  ==  !=          (binary)
 *   level 5  <  >  <=  >=    (binary)
 *   level 6  +  -            (binary)
 *   level 7  *  /  %         (binary)
 *
 * The `contracts/` operator string unions (`BinaryOperator`, `LogicalOperator`)
 * are imported literally — the operator strings the parser stamps onto nodes come
 * straight from this table, never re-spelled at each construction site.
 */

import { TokenType } from "@contracts";
import type { BinaryOperator, LogicalOperator } from "@contracts";

/**
 * One row of the precedence table: an infix operator's binding power, the AST
 * discriminant it produces (`BinaryExpression` vs the short-circuiting
 * `LogicalExpression`), and the operator string stamped onto that node.
 */
export interface InfixOperator {
  /** Binding power; higher binds tighter. See the module header ladder. */
  readonly precedence: number;
  /** Which AST node this operator builds. Logical ops short-circuit at runtime. */
  readonly node: "binary" | "logical";
  /** The exact contract operator string placed on the produced node. */
  readonly operator: BinaryOperator | LogicalOperator;
}

/**
 * The numeric precedence levels, named so the parser and tests can refer to them
 * symbolically. Values mirror `docs/LANGUAGE.md`: 1 (assignment) binds loosest,
 * 9 (postfix) binds tightest; this object covers only the climbing-loop band.
 */
export const PRECEDENCE = {
  OR: 2,
  AND: 3,
  EQUALITY: 4,
  RELATIONAL: 5,
  ADDITIVE: 6,
  MULTIPLICATIVE: 7,
} as const;

/**
 * The loosest binding power the precedence-climbing loop begins at — the logical
 * OR level. Assignment (level 1) sits below this and is handled separately (it is
 * right-associative and constrains its left-hand side to an assignment target).
 */
export const LOWEST_INFIX_PRECEDENCE = PRECEDENCE.OR;

/**
 * The infix operator table. A `TokenType` absent from this map is not an infix
 * operator (it terminates the current expression). Access is `undefined`-checked
 * by the parser (the project compiles under `noUncheckedIndexedAccess`).
 */
export const INFIX_OPERATORS: Partial<Record<TokenType, InfixOperator>> = {
  [TokenType.Or]: {
    precedence: PRECEDENCE.OR,
    node: "logical",
    operator: "||",
  },
  [TokenType.And]: {
    precedence: PRECEDENCE.AND,
    node: "logical",
    operator: "&&",
  },
  [TokenType.Eq]: {
    precedence: PRECEDENCE.EQUALITY,
    node: "binary",
    operator: "==",
  },
  [TokenType.NotEq]: {
    precedence: PRECEDENCE.EQUALITY,
    node: "binary",
    operator: "!=",
  },
  [TokenType.Lt]: {
    precedence: PRECEDENCE.RELATIONAL,
    node: "binary",
    operator: "<",
  },
  [TokenType.Gt]: {
    precedence: PRECEDENCE.RELATIONAL,
    node: "binary",
    operator: ">",
  },
  [TokenType.LtEq]: {
    precedence: PRECEDENCE.RELATIONAL,
    node: "binary",
    operator: "<=",
  },
  [TokenType.GtEq]: {
    precedence: PRECEDENCE.RELATIONAL,
    node: "binary",
    operator: ">=",
  },
  [TokenType.Plus]: {
    precedence: PRECEDENCE.ADDITIVE,
    node: "binary",
    operator: "+",
  },
  [TokenType.Minus]: {
    precedence: PRECEDENCE.ADDITIVE,
    node: "binary",
    operator: "-",
  },
  [TokenType.Star]: {
    precedence: PRECEDENCE.MULTIPLICATIVE,
    node: "binary",
    operator: "*",
  },
  [TokenType.Slash]: {
    precedence: PRECEDENCE.MULTIPLICATIVE,
    node: "binary",
    operator: "/",
  },
  [TokenType.Percent]: {
    precedence: PRECEDENCE.MULTIPLICATIVE,
    node: "binary",
    operator: "%",
  },
};
