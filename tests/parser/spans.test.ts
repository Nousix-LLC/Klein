/**
 * Span-accuracy tests. Every AST node must carry a half-open `[start, end)` span
 * with 0-based offsets and 1-based line/column, running from the construct's first
 * token to its last. Diagnostics (and, later, editor tooling) are only as good as
 * these spans, so they are pinned precisely here.
 */

import { describe, it, expect } from "vitest";

import type { Expression, Statement } from "@contracts";
import { parse } from "./helpers";

/** First statement of a clean parse of `src` (asserting no errors). */
function firstStatement(src: string): Statement {
  const { program, errors } = parse(src);
  expect(errors).toEqual([]);
  const stmt = program.body[0];
  if (stmt === undefined) throw new Error("no statement parsed");
  return stmt;
}

/** The expression inside `<src>;` parsed as a single expression statement. */
function expressionOf(src: string): Expression {
  const stmt = firstStatement(`${src};`);
  if (stmt.kind !== "ExpressionStatement") throw new Error("not an expression");
  return stmt.expression;
}

describe("literal spans", () => {
  it("spans a number literal exactly", () => {
    const expr = expressionOf("42");
    expect(expr.span.start.offset).toBe(0);
    expect(expr.span.end.offset).toBe(2);
    expect(expr.span.source).toBe("test.kl");
  });
});

describe("composite expression spans", () => {
  it("spans a binary expression from first operand to last", () => {
    const expr = expressionOf("1 + 2");
    expect(expr.span.start.offset).toBe(0);
    expect(expr.span.end.offset).toBe(5);
    expect(expr.kind === "BinaryExpression" && expr.left.span.end.offset).toBe(
      1,
    );
    expect(
      expr.kind === "BinaryExpression" && expr.right.span.start.offset,
    ).toBe(4);
  });

  it("spans a unary expression from operator to operand", () => {
    const expr = expressionOf("-x");
    expect(expr.span.start.offset).toBe(0);
    expect(expr.span.end.offset).toBe(2);
  });

  it("spans a call from callee through the closing paren", () => {
    const expr = expressionOf("f(x)");
    expect(expr.span.start.offset).toBe(0);
    expect(expr.span.end.offset).toBe(4);
  });

  it("records a member's propertySpan and overall span", () => {
    const expr = expressionOf("o.k");
    if (expr.kind !== "MemberExpression") throw new Error("expected member");
    expect(expr.span.start.offset).toBe(0);
    expect(expr.span.end.offset).toBe(3);
    expect(expr.propertySpan.start.offset).toBe(2);
    expect(expr.propertySpan.end.offset).toBe(3);
  });

  it("keeps a parenthesized expression's inner span (parens build no node)", () => {
    const expr = expressionOf("(1 + 2)");
    // The span covers `1 + 2` (offsets 1..6), not the surrounding parens.
    expect(expr.kind).toBe("BinaryExpression");
    expect(expr.span.start.offset).toBe(1);
    expect(expr.span.end.offset).toBe(6);
  });
});

describe("statement spans", () => {
  it("spans a let statement through its terminating semicolon", () => {
    const stmt = firstStatement("let x = 5;");
    expect(stmt.span.start.offset).toBe(0);
    expect(stmt.span.end.offset).toBe(10);
    if (stmt.kind !== "LetStatement") throw new Error("expected let");
    expect(stmt.nameSpan.start.offset).toBe(4);
    expect(stmt.nameSpan.end.offset).toBe(5);
    expect(stmt.value.span.start.offset).toBe(8);
  });

  it("records a function declaration's nameSpan", () => {
    const stmt = firstStatement("fn add() {}");
    if (stmt.kind !== "FunctionDeclaration")
      throw new Error("expected fn decl");
    expect(stmt.nameSpan.start.offset).toBe(3);
    expect(stmt.nameSpan.end.offset).toBe(6);
  });

  it("records an object entry's keySpan", () => {
    // Object literals live in expression position; a leading `{` at statement
    // position is a block. Offsets below index into `let o = {a: 1};`.
    const stmt = firstStatement("let o = {a: 1};");
    if (stmt.kind !== "LetStatement" || stmt.value.kind !== "ObjectLiteral") {
      throw new Error("expected an object literal binding");
    }
    const entry = stmt.value.entries[0];
    expect(entry?.keySpan.start.offset).toBe(9);
    expect(entry?.keySpan.end.offset).toBe(10);
  });
});

describe("line / column tracking across newlines", () => {
  it("anchors a second-line statement at line 2", () => {
    const stmt = firstStatement("let x = 1;\nlet y = 2;");
    const { program } = parse("let x = 1;\nlet y = 2;");
    const second = program.body[1];
    expect(second?.span.start.line).toBe(2);
    expect(second?.span.start.column).toBe(1);
    // (first statement sanity)
    expect(stmt.span.start.line).toBe(1);
  });
});
