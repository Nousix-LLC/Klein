/**
 * Expression-grammar tests: literals, the full precedence/associativity ladder,
 * unary, the postfix call/index/member band, and the composite literals
 * (array / object / function). These pin the exact tree shape the runtime will
 * consume, so precedence bugs surface here rather than as mysterious evaluation
 * results downstream.
 */

import { describe, it, expect } from "vitest";

import { parseExpression } from "./helpers";

describe("literals", () => {
  it("parses a number literal with its decoded value", () => {
    const expr = parseExpression("42");
    expect(expr).toMatchObject({ kind: "NumberLiteral", value: 42 });
  });

  it("parses hex and exponent numbers (decoded by the lexer)", () => {
    expect(parseExpression("0xFF")).toMatchObject({ value: 255 });
    expect(parseExpression("2.5e-3")).toMatchObject({ value: 0.0025 });
  });

  it("parses a string literal with escapes already decoded", () => {
    const expr = parseExpression('"a\\nb"');
    expect(expr).toMatchObject({ kind: "StringLiteral", value: "a\nb" });
  });

  it("parses boolean and null literals", () => {
    expect(parseExpression("true")).toMatchObject({
      kind: "BooleanLiteral",
      value: true,
    });
    expect(parseExpression("false")).toMatchObject({
      kind: "BooleanLiteral",
      value: false,
    });
    expect(parseExpression("null")).toMatchObject({ kind: "NullLiteral" });
  });

  it("parses an identifier", () => {
    expect(parseExpression("foo_bar1")).toMatchObject({
      kind: "Identifier",
      name: "foo_bar1",
    });
  });
});

describe("binary precedence", () => {
  it("multiplicative binds tighter than additive: 1 + 2 * 3", () => {
    const expr = parseExpression("1 + 2 * 3");
    expect(expr).toMatchObject({
      kind: "BinaryExpression",
      operator: "+",
      left: { kind: "NumberLiteral", value: 1 },
      right: {
        kind: "BinaryExpression",
        operator: "*",
        left: { value: 2 },
        right: { value: 3 },
      },
    });
  });

  it("additive binds tighter than equality: 2 + 3 == 5", () => {
    const expr = parseExpression("2 + 3 == 5");
    expect(expr).toMatchObject({
      kind: "BinaryExpression",
      operator: "==",
      left: { kind: "BinaryExpression", operator: "+" },
      right: { value: 5 },
    });
  });

  it("relational binds tighter than equality: a < b == c", () => {
    const expr = parseExpression("a < b == c");
    expect(expr).toMatchObject({
      operator: "==",
      left: { kind: "BinaryExpression", operator: "<" },
      right: { kind: "Identifier", name: "c" },
    });
  });

  it("binary operators are left-associative: 1 - 2 - 3 → (1 - 2) - 3", () => {
    const expr = parseExpression("1 - 2 - 3");
    expect(expr).toMatchObject({
      operator: "-",
      left: {
        kind: "BinaryExpression",
        operator: "-",
        left: { value: 1 },
        right: { value: 2 },
      },
      right: { value: 3 },
    });
  });

  it("mixes multiplicative operators left-to-right: 8 / 2 % 3", () => {
    const expr = parseExpression("8 / 2 % 3");
    expect(expr).toMatchObject({
      operator: "%",
      left: { operator: "/", left: { value: 8 }, right: { value: 2 } },
      right: { value: 3 },
    });
  });
});

describe("logical operators", () => {
  it("builds LogicalExpression nodes (kept distinct from BinaryExpression)", () => {
    const expr = parseExpression("a && b");
    expect(expr).toMatchObject({
      kind: "LogicalExpression",
      operator: "&&",
      left: { name: "a" },
      right: { name: "b" },
    });
  });

  it("&& binds tighter than ||: a && b || c → (a && b) || c", () => {
    const expr = parseExpression("a && b || c");
    expect(expr).toMatchObject({
      kind: "LogicalExpression",
      operator: "||",
      left: { kind: "LogicalExpression", operator: "&&" },
      right: { name: "c" },
    });
  });

  it("equality binds tighter than &&: a == b && c", () => {
    const expr = parseExpression("a == b && c");
    expect(expr).toMatchObject({
      kind: "LogicalExpression",
      operator: "&&",
      left: { kind: "BinaryExpression", operator: "==" },
      right: { name: "c" },
    });
  });
});

describe("unary", () => {
  it("prefix minus binds tighter than multiplicative: -2 * 3 → (-2) * 3", () => {
    const expr = parseExpression("-2 * 3");
    expect(expr).toMatchObject({
      kind: "BinaryExpression",
      operator: "*",
      left: { kind: "UnaryExpression", operator: "-", operand: { value: 2 } },
      right: { value: 3 },
    });
  });

  it("prefix bang binds tighter than equality: !a == b → (!a) == b", () => {
    const expr = parseExpression("!a == b");
    expect(expr).toMatchObject({
      operator: "==",
      left: { kind: "UnaryExpression", operator: "!", operand: { name: "a" } },
      right: { name: "b" },
    });
  });

  it("unary is right-associative / stackable: !!a and - -2", () => {
    expect(parseExpression("!!a")).toMatchObject({
      kind: "UnaryExpression",
      operator: "!",
      operand: {
        kind: "UnaryExpression",
        operator: "!",
        operand: { name: "a" },
      },
    });
    expect(parseExpression("- -2")).toMatchObject({
      operator: "-",
      operand: {
        kind: "UnaryExpression",
        operator: "-",
        operand: { value: 2 },
      },
    });
  });
});

describe("assignment", () => {
  it("is right-associative: x = y = 1 → x = (y = 1)", () => {
    const expr = parseExpression("x = y = 1");
    expect(expr).toMatchObject({
      kind: "AssignmentExpression",
      target: { kind: "Identifier", name: "x" },
      value: {
        kind: "AssignmentExpression",
        target: { kind: "Identifier", name: "y" },
        value: { value: 1 },
      },
    });
  });

  it("binds looser than every operator: a = b + c", () => {
    const expr = parseExpression("a = b + c");
    expect(expr).toMatchObject({
      kind: "AssignmentExpression",
      target: { name: "a" },
      value: { kind: "BinaryExpression", operator: "+" },
    });
  });

  it("accepts index and member targets", () => {
    expect(parseExpression("a[i] = v")).toMatchObject({
      kind: "AssignmentExpression",
      target: { kind: "IndexExpression" },
    });
    expect(parseExpression("o.k = v")).toMatchObject({
      kind: "AssignmentExpression",
      target: { kind: "MemberExpression", property: "k" },
    });
  });
});

describe("postfix call / index / member", () => {
  it("parses a call with arguments", () => {
    const expr = parseExpression("f(a, b, c)");
    expect(expr).toMatchObject({
      kind: "CallExpression",
      callee: { name: "f" },
      args: [{ name: "a" }, { name: "b" }, { name: "c" }],
    });
  });

  it("parses an empty call", () => {
    const expr = parseExpression("f()");
    expect(expr).toMatchObject({ kind: "CallExpression", args: [] });
  });

  it("parses index and member access", () => {
    expect(parseExpression("a[0]")).toMatchObject({
      kind: "IndexExpression",
      object: { name: "a" },
      index: { value: 0 },
    });
    expect(parseExpression("o.k")).toMatchObject({
      kind: "MemberExpression",
      object: { name: "o" },
      property: "k",
    });
  });

  it("chains suffixes left-to-right: o.a[i](x).b → ((((o.a)[i])(x)).b)", () => {
    const expr = parseExpression("o.a[i](x).b");
    expect(expr).toMatchObject({
      kind: "MemberExpression",
      property: "b",
      object: {
        kind: "CallExpression",
        args: [{ name: "x" }],
        callee: {
          kind: "IndexExpression",
          index: { name: "i" },
          object: {
            kind: "MemberExpression",
            property: "a",
            object: { kind: "Identifier", name: "o" },
          },
        },
      },
    });
  });
});

describe("grouping", () => {
  it("overrides precedence and builds no node of its own", () => {
    const expr = parseExpression("(1 + 2) * 3");
    // The parenthesized sum appears directly as the left operand — no wrapper.
    expect(expr).toMatchObject({
      kind: "BinaryExpression",
      operator: "*",
      left: {
        kind: "BinaryExpression",
        operator: "+",
        left: { value: 1 },
        right: { value: 2 },
      },
      right: { value: 3 },
    });
  });
});

describe("array literals", () => {
  it("parses a non-empty array", () => {
    const expr = parseExpression("[1, 2, 3]");
    expect(expr).toMatchObject({
      kind: "ArrayLiteral",
      elements: [{ value: 1 }, { value: 2 }, { value: 3 }],
    });
  });

  it("parses an empty array", () => {
    expect(parseExpression("[]")).toMatchObject({
      kind: "ArrayLiteral",
      elements: [],
    });
  });

  it("parses nested arrays with inner expressions", () => {
    const expr = parseExpression("[1 + 1, [2]]");
    expect(expr).toMatchObject({
      elements: [
        { kind: "BinaryExpression", operator: "+" },
        { kind: "ArrayLiteral", elements: [{ value: 2 }] },
      ],
    });
  });
});

describe("object literals", () => {
  it("parses identifier and string keys, both as string keys", () => {
    const expr = parseExpression('{ a: 1, "b c": 2 }');
    expect(expr).toMatchObject({
      kind: "ObjectLiteral",
      entries: [
        { key: "a", value: { value: 1 } },
        { key: "b c", value: { value: 2 } },
      ],
    });
  });

  it("parses an empty object", () => {
    expect(parseExpression("{}")).toMatchObject({
      kind: "ObjectLiteral",
      entries: [],
    });
  });
});

describe("function literals", () => {
  it("parses an anonymous function expression", () => {
    const expr = parseExpression("fn(a, b) { return a; }");
    expect(expr).toMatchObject({
      kind: "FunctionLiteral",
      params: [{ name: "a" }, { name: "b" }],
      body: {
        kind: "BlockStatement",
        statements: [{ kind: "ReturnStatement" }],
      },
    });
  });

  it("parses a zero-parameter function literal", () => {
    expect(parseExpression("fn() { 1; }")).toMatchObject({
      kind: "FunctionLiteral",
      params: [],
    });
  });
});
