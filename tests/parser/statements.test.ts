/**
 * Statement-grammar tests: every statement form in `contracts/ast.ts`, including
 * the `else if` chaining shape, the C-style `for` header with optional clauses,
 * and function declarations with their parameter lists. Together with
 * `expressions.test.ts` these cover every AST node kind the parser produces.
 */

import { describe, it, expect } from "vitest";

import { parseStatement, parseStatements } from "./helpers";

describe("let statement", () => {
  it("parses a binding with an initializer", () => {
    expect(parseStatement("let x = 1 + 2;")).toMatchObject({
      kind: "LetStatement",
      name: "x",
      value: { kind: "BinaryExpression", operator: "+" },
    });
  });
});

describe("expression statement", () => {
  it("wraps a bare expression", () => {
    expect(parseStatement("f(x);")).toMatchObject({
      kind: "ExpressionStatement",
      expression: { kind: "CallExpression" },
    });
  });
});

describe("block statement", () => {
  it("groups statements and nests", () => {
    expect(parseStatement("{ let x = 1; x; }")).toMatchObject({
      kind: "BlockStatement",
      statements: [
        { kind: "LetStatement", name: "x" },
        { kind: "ExpressionStatement" },
      ],
    });
  });

  it("parses an empty block", () => {
    expect(parseStatement("{}")).toMatchObject({
      kind: "BlockStatement",
      statements: [],
    });
  });
});

describe("if / else if / else", () => {
  it("parses a bare if (no alternate)", () => {
    expect(parseStatement("if (c) { a; }")).toMatchObject({
      kind: "IfStatement",
      condition: { name: "c" },
      consequent: { kind: "BlockStatement" },
      alternate: null,
    });
  });

  it("parses an if with an else block", () => {
    expect(parseStatement("if (c) { a; } else { b; }")).toMatchObject({
      kind: "IfStatement",
      alternate: {
        kind: "BlockStatement",
        statements: [{ kind: "ExpressionStatement" }],
      },
    });
  });

  it("represents `else if` as an alternate that is itself an IfStatement", () => {
    const stmt = parseStatement("if (a) { 1; } else if (b) { 2; } else { 3; }");
    expect(stmt).toMatchObject({
      kind: "IfStatement",
      condition: { name: "a" },
      alternate: {
        kind: "IfStatement",
        condition: { name: "b" },
        alternate: { kind: "BlockStatement" },
      },
    });
  });
});

describe("while statement", () => {
  it("parses a while loop", () => {
    expect(parseStatement("while (i < 10) { i = i + 1; }")).toMatchObject({
      kind: "WhileStatement",
      condition: { kind: "BinaryExpression", operator: "<" },
      body: { kind: "BlockStatement" },
    });
  });
});

describe("for statement", () => {
  it("parses a full C-style header with a let initializer", () => {
    const stmt = parseStatement("for (let i = 0; i < 10; i = i + 1) { body; }");
    expect(stmt).toMatchObject({
      kind: "ForStatement",
      init: { kind: "LetStatement", name: "i", value: { value: 0 } },
      condition: { kind: "BinaryExpression", operator: "<" },
      update: { kind: "AssignmentExpression" },
      body: { kind: "BlockStatement" },
    });
  });

  it("parses an expression initializer", () => {
    const stmt = parseStatement("for (i = 0; ; ) { body; }");
    expect(stmt).toMatchObject({
      kind: "ForStatement",
      init: {
        kind: "ExpressionStatement",
        expression: { kind: "AssignmentExpression" },
      },
      condition: null,
      update: null,
    });
  });

  it("parses a bare infinite loop for (;;)", () => {
    expect(parseStatement("for (;;) { body; }")).toMatchObject({
      kind: "ForStatement",
      init: null,
      condition: null,
      update: null,
    });
  });
});

describe("return / break / continue", () => {
  it("parses return with a value", () => {
    expect(parseStatement("return x + 1;")).toMatchObject({
      kind: "ReturnStatement",
      value: { kind: "BinaryExpression" },
    });
  });

  it("parses a bare return (null value)", () => {
    expect(parseStatement("return;")).toMatchObject({
      kind: "ReturnStatement",
      value: null,
    });
  });

  it("parses break and continue", () => {
    expect(parseStatement("break;")).toMatchObject({ kind: "BreakStatement" });
    expect(parseStatement("continue;")).toMatchObject({
      kind: "ContinueStatement",
    });
  });
});

describe("function declaration", () => {
  it("parses a named function with parameters", () => {
    expect(parseStatement("fn add(a, b) { return a + b; }")).toMatchObject({
      kind: "FunctionDeclaration",
      name: "add",
      params: [{ name: "a" }, { name: "b" }],
      body: {
        kind: "BlockStatement",
        statements: [{ kind: "ReturnStatement" }],
      },
    });
  });

  it("parses a zero-parameter declaration", () => {
    expect(parseStatement("fn noop() {}")).toMatchObject({
      kind: "FunctionDeclaration",
      name: "noop",
      params: [],
    });
  });
});

describe("multiple top-level statements", () => {
  it("parses a small program into an ordered body", () => {
    const body = parseStatements(
      "fn fib(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); } let x = fib(10);",
    );
    expect(body.map((s) => s.kind)).toEqual([
      "FunctionDeclaration",
      "LetStatement",
    ]);
  });
});
