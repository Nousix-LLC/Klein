/**
 * CONTRACT — Abstract Syntax Tree for the Klein language.
 *
 * READ-ONLY. The parser PRODUCES these node types; the runtime CONSUMES them.
 * Every node is discriminated by a literal `kind` field and carries a `span`.
 * Nodes are plain data (no methods) so they serialize and snapshot cleanly.
 *
 * Import, do not re-declare:
 *     import { Program, Expression, Statement } from "../../contracts/ast";
 *
 * Amendments are additive only (new node kinds may be added to the unions).
 */

import { Span } from "./tokens";

/** Common base: every AST node knows its source span. */
export interface NodeBase {
  readonly span: Span;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expressions
// ─────────────────────────────────────────────────────────────────────────────

export interface NumberLiteral extends NodeBase {
  readonly kind: "NumberLiteral";
  readonly value: number;
}

export interface StringLiteral extends NodeBase {
  readonly kind: "StringLiteral";
  readonly value: string;
}

export interface BooleanLiteral extends NodeBase {
  readonly kind: "BooleanLiteral";
  readonly value: boolean;
}

export interface NullLiteral extends NodeBase {
  readonly kind: "NullLiteral";
}

export interface Identifier extends NodeBase {
  readonly kind: "Identifier";
  readonly name: string;
}

export interface ArrayLiteral extends NodeBase {
  readonly kind: "ArrayLiteral";
  readonly elements: readonly Expression[];
}

/** A single `key: value` pair inside an object literal. Keys are always strings. */
export interface ObjectEntry {
  /** The resolved string key (from an identifier or a string literal). */
  readonly key: string;
  readonly keySpan: Span;
  readonly value: Expression;
}

export interface ObjectLiteral extends NodeBase {
  readonly kind: "ObjectLiteral";
  readonly entries: readonly ObjectEntry[];
}

/** A formal parameter in a function definition. */
export interface Parameter {
  readonly name: string;
  readonly span: Span;
}

/** Anonymous function expression: `fn(a, b) { ... }`. */
export interface FunctionLiteral extends NodeBase {
  readonly kind: "FunctionLiteral";
  readonly params: readonly Parameter[];
  readonly body: BlockStatement;
}

export type UnaryOperator = "-" | "!";

export interface UnaryExpression extends NodeBase {
  readonly kind: "UnaryExpression";
  readonly operator: UnaryOperator;
  readonly operand: Expression;
}

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">=";

export interface BinaryExpression extends NodeBase {
  readonly kind: "BinaryExpression";
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type LogicalOperator = "&&" | "||";

/** Kept distinct from BinaryExpression because it short-circuits. */
export interface LogicalExpression extends NodeBase {
  readonly kind: "LogicalExpression";
  readonly operator: LogicalOperator;
  readonly left: Expression;
  readonly right: Expression;
}

/** An assignable location: `x`, `arr[i]`, or `obj.prop`. */
export type AssignmentTarget = Identifier | IndexExpression | MemberExpression;

export interface AssignmentExpression extends NodeBase {
  readonly kind: "AssignmentExpression";
  readonly target: AssignmentTarget;
  readonly value: Expression;
}

export interface CallExpression extends NodeBase {
  readonly kind: "CallExpression";
  readonly callee: Expression;
  readonly args: readonly Expression[];
}

/** Dynamic indexing: `object[index]`. */
export interface IndexExpression extends NodeBase {
  readonly kind: "IndexExpression";
  readonly object: Expression;
  readonly index: Expression;
}

/** Static member access: `object.property`. */
export interface MemberExpression extends NodeBase {
  readonly kind: "MemberExpression";
  readonly object: Expression;
  readonly property: string;
  readonly propertySpan: Span;
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | ArrayLiteral
  | ObjectLiteral
  | FunctionLiteral
  | UnaryExpression
  | BinaryExpression
  | LogicalExpression
  | AssignmentExpression
  | CallExpression
  | IndexExpression
  | MemberExpression;

// ─────────────────────────────────────────────────────────────────────────────
// Statements
// ─────────────────────────────────────────────────────────────────────────────

export interface LetStatement extends NodeBase {
  readonly kind: "LetStatement";
  readonly name: string;
  readonly nameSpan: Span;
  readonly value: Expression;
}

export interface ExpressionStatement extends NodeBase {
  readonly kind: "ExpressionStatement";
  readonly expression: Expression;
}

export interface BlockStatement extends NodeBase {
  readonly kind: "BlockStatement";
  readonly statements: readonly Statement[];
}

export interface IfStatement extends NodeBase {
  readonly kind: "IfStatement";
  readonly condition: Expression;
  readonly consequent: BlockStatement;
  /** `else if` is represented as an alternate that is itself an IfStatement. */
  readonly alternate: BlockStatement | IfStatement | null;
}

export interface WhileStatement extends NodeBase {
  readonly kind: "WhileStatement";
  readonly condition: Expression;
  readonly body: BlockStatement;
}

/** C-style `for (init; condition; update) body`. All three clauses optional. */
export interface ForStatement extends NodeBase {
  readonly kind: "ForStatement";
  readonly init: LetStatement | ExpressionStatement | null;
  readonly condition: Expression | null;
  readonly update: Expression | null;
  readonly body: BlockStatement;
}

export interface ReturnStatement extends NodeBase {
  readonly kind: "ReturnStatement";
  readonly value: Expression | null;
}

export interface BreakStatement extends NodeBase {
  readonly kind: "BreakStatement";
}

export interface ContinueStatement extends NodeBase {
  readonly kind: "ContinueStatement";
}

/** Named function declaration: `fn name(a, b) { ... }`. Hoisted-by-value at runtime. */
export interface FunctionDeclaration extends NodeBase {
  readonly kind: "FunctionDeclaration";
  readonly name: string;
  readonly nameSpan: Span;
  readonly params: readonly Parameter[];
  readonly body: BlockStatement;
}

export type Statement =
  | LetStatement
  | ExpressionStatement
  | BlockStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | FunctionDeclaration;

// ─────────────────────────────────────────────────────────────────────────────
// Program root
// ─────────────────────────────────────────────────────────────────────────────

export interface Program extends NodeBase {
  readonly kind: "Program";
  readonly body: readonly Statement[];
}

export type Node = Program | Statement | Expression;

/** Any callable-definition node (used by the runtime to build closures). */
export type FunctionNode = FunctionLiteral | FunctionDeclaration;
