/**
 * Unit tests for the Klein value system (`src/runtime/values.ts`).
 *
 * These exercise the four cohesive concerns of the value model — constructors,
 * truthiness, `==` equality, and the canonical stringifier — directly against the
 * `Value` union. Value-model functions are pure over `Value`, so the values are
 * built with the module's own constructors rather than by running a program.
 *
 * Where a `FunctionValue` is needed, its AST `node` comes from the **real** lexer
 * + parser (never a hand-mocked AST, per the runtime subtree convention); the
 * `Environment` closure is a small structural stub, since the concrete
 * `Environment` is a sibling task this module must not depend on.
 */

import { describe, expect, it } from "vitest";

import {
  type Environment,
  type FunctionNode,
  type BuiltinImpl,
  type Value,
  ValueKind,
} from "@contracts";
import { Lexer } from "../../src/lexer";
import { Parser } from "../../src/parser";
import {
  FALSE,
  NULL,
  TRUE,
  isTruthy,
  makeArray,
  makeBoolean,
  makeBuiltin,
  makeFunction,
  makeNull,
  makeNumber,
  makeObject,
  makeString,
  stringify,
  valuesEqual,
} from "../../src/runtime/values";

// ── Test fixtures ────────────────────────────────────────────────────────────

/** A structural `Environment` stub (the real `Environment` is a sibling task). */
function envStub(): Environment {
  const env: Environment = {
    parent: null,
    define: () => undefined,
    get: () => NULL,
    assign: () => undefined,
    has: () => false,
    child: () => envStub(),
  };
  return env;
}

/** Parse `src` with the real lexer + parser and return the first `fn` node. */
function functionNode(src = "fn f(x) { x; }"): FunctionNode {
  const { tokens } = new Lexer(src, "fixture.kl").tokenize();
  const { program } = new Parser(tokens, "fixture.kl").parse();
  const decl = program.body[0];
  if (decl?.kind !== "FunctionDeclaration") {
    throw new Error("fixture must parse to a function declaration");
  }
  return decl;
}

const noopImpl: BuiltinImpl = () => NULL;

// ── Constructors ─────────────────────────────────────────────────────────────

describe("constructors", () => {
  it("build a value of the correct kind for every ValueKind", () => {
    expect(makeNull().kind).toBe(ValueKind.Null);
    expect(makeBoolean(true).kind).toBe(ValueKind.Boolean);
    expect(makeNumber(1).kind).toBe(ValueKind.Number);
    expect(makeString("x").kind).toBe(ValueKind.String);
    expect(makeArray().kind).toBe(ValueKind.Array);
    expect(makeObject().kind).toBe(ValueKind.Object);
    expect(makeFunction(functionNode(), envStub(), "f").kind).toBe(
      ValueKind.Function,
    );
    expect(makeBuiltin("b", { min: 0, max: 0 }, noopImpl).kind).toBe(
      ValueKind.Builtin,
    );
  });

  it("share singletons for null and the two booleans", () => {
    expect(makeNull()).toBe(NULL);
    expect(makeNull()).toBe(makeNull());
    expect(makeBoolean(true)).toBe(TRUE);
    expect(makeBoolean(false)).toBe(FALSE);
    expect(TRUE).not.toBe(FALSE);
  });

  it("wrap the underlying primitive value", () => {
    expect(makeBoolean(false).value).toBe(false);
    expect(makeNumber(3.5).value).toBe(3.5);
    expect(makeString("hi").value).toBe("hi");
  });

  it("give each array/object a fresh, independent backing store", () => {
    expect(makeArray()).not.toBe(makeArray());
    expect(makeArray().elements).toEqual([]);
    expect(makeObject()).not.toBe(makeObject());
    expect(makeObject().entries.size).toBe(0);
  });

  it("store the array backing reference (mutable reference value)", () => {
    const backing: Value[] = [makeNumber(1)];
    const arr = makeArray(backing);
    expect(arr.elements).toBe(backing);
    backing.push(makeNumber(2));
    expect(arr.elements).toHaveLength(2); // mutation visible through the value
  });

  it("preserve object key insertion order", () => {
    const obj = makeObject([
      ["b", makeNumber(1)],
      ["a", makeNumber(2)],
    ]);
    expect([...obj.entries.keys()]).toEqual(["b", "a"]);
  });

  it("carry function node/closure/name (null name for anonymous)", () => {
    const node = functionNode();
    const closure = envStub();
    const named = makeFunction(node, closure, "greet");
    expect(named.node).toBe(node);
    expect(named.closure).toBe(closure);
    expect(named.name).toBe("greet");
    expect(makeFunction(node, closure, null).name).toBeNull();
  });

  it("carry builtin name/arity/impl", () => {
    const arity = { min: 1, max: null };
    const b = makeBuiltin("len", arity, noopImpl);
    expect(b.name).toBe("len");
    expect(b.arity).toBe(arity);
    expect(b.impl).toBe(noopImpl);
  });
});

// ── Truthiness ───────────────────────────────────────────────────────────────

describe("isTruthy", () => {
  it("treats only null and false as falsy", () => {
    expect(isTruthy(NULL)).toBe(false);
    expect(isTruthy(FALSE)).toBe(false);
  });

  it("treats everything else — including 0, '', [], {} — as truthy", () => {
    expect(isTruthy(TRUE)).toBe(true);
    expect(isTruthy(makeNumber(0))).toBe(true);
    expect(isTruthy(makeNumber(1))).toBe(true);
    expect(isTruthy(makeString(""))).toBe(true);
    expect(isTruthy(makeString("x"))).toBe(true);
    expect(isTruthy(makeArray())).toBe(true);
    expect(isTruthy(makeObject())).toBe(true);
    expect(isTruthy(makeFunction(functionNode(), envStub(), "f"))).toBe(true);
    expect(isTruthy(makeBuiltin("b", { min: 0, max: 0 }, noopImpl))).toBe(true);
  });
});

// ── Equality (==) ────────────────────────────────────────────────────────────

describe("valuesEqual", () => {
  it("compares primitives structurally", () => {
    expect(valuesEqual(makeNull(), makeNull())).toBe(true);
    expect(valuesEqual(makeBoolean(true), makeBoolean(true))).toBe(true);
    expect(valuesEqual(makeBoolean(true), makeBoolean(false))).toBe(false);
    expect(valuesEqual(makeNumber(42), makeNumber(42))).toBe(true);
    expect(valuesEqual(makeNumber(1), makeNumber(2))).toBe(false);
    expect(valuesEqual(makeString("ab"), makeString("ab"))).toBe(true);
    expect(valuesEqual(makeString("ab"), makeString("ba"))).toBe(false);
  });

  it("follows IEEE-754 for numbers (NaN != NaN, +0 == -0)", () => {
    expect(valuesEqual(makeNumber(NaN), makeNumber(NaN))).toBe(false);
    expect(valuesEqual(makeNumber(0), makeNumber(-0))).toBe(true);
  });

  it("compares arrays/objects/functions/builtins by reference identity", () => {
    const arr = makeArray([makeNumber(1)]);
    expect(valuesEqual(arr, arr)).toBe(true);
    expect(
      valuesEqual(makeArray([makeNumber(1)]), makeArray([makeNumber(1)])),
    ).toBe(false); // distinct-but-equal arrays are not equal

    const obj = makeObject([["a", makeNumber(1)]]);
    expect(valuesEqual(obj, obj)).toBe(true);
    expect(valuesEqual(makeObject(), makeObject())).toBe(false);

    const node = functionNode();
    const fn = makeFunction(node, envStub(), "f");
    expect(valuesEqual(fn, fn)).toBe(true);
    expect(
      valuesEqual(
        makeFunction(node, envStub(), "f"),
        makeFunction(node, envStub(), "f"),
      ),
    ).toBe(false);

    const builtin = makeBuiltin("b", { min: 0, max: 0 }, noopImpl);
    expect(valuesEqual(builtin, builtin)).toBe(true);
    expect(
      valuesEqual(
        makeBuiltin("b", { min: 0, max: 0 }, noopImpl),
        makeBuiltin("b", { min: 0, max: 0 }, noopImpl),
      ),
    ).toBe(false);
  });

  it("never equates values of different kinds (no coercion, no error)", () => {
    expect(valuesEqual(makeNumber(1), makeString("1"))).toBe(false);
    expect(valuesEqual(makeNull(), makeBoolean(false))).toBe(false);
    expect(valuesEqual(makeArray(), makeObject())).toBe(false);
    expect(valuesEqual(makeNumber(0), makeNull())).toBe(false);
  });
});

// ── Stringifier ──────────────────────────────────────────────────────────────

describe("stringify", () => {
  it("renders primitive scalars", () => {
    expect(stringify(NULL)).toBe("null");
    expect(stringify(TRUE)).toBe("true");
    expect(stringify(FALSE)).toBe("false");
  });

  it("renders a top-level string as its raw contents (no quotes)", () => {
    expect(stringify(makeString("hello"))).toBe("hello");
    expect(stringify(makeString(""))).toBe("");
    expect(stringify(makeString('a "quote" and \\ slash'))).toBe(
      'a "quote" and \\ slash',
    );
  });

  it.each<[number, string]>([
    [42, "42"],
    [-5, "-5"],
    [0, "0"],
    [-0, "0"],
    [3.14, "3.14"],
    [0.5, "0.5"],
    [1e21, "1e+21"],
    [NaN, "NaN"],
    [Infinity, "Infinity"],
    [-Infinity, "-Infinity"],
  ])("formats the number %p as %p (integers without a trailing .0)", (n, s) => {
    expect(stringify(makeNumber(n))).toBe(s);
  });

  it("renders arrays, quoting nested strings so they stay unambiguous", () => {
    expect(stringify(makeArray())).toBe("[]");
    expect(
      stringify(
        makeArray([
          makeNumber(1),
          makeString("1"),
          TRUE,
          NULL,
          makeArray([makeNumber(2)]),
        ]),
      ),
    ).toBe('[1, "1", true, null, [2]]');
  });

  it("renders objects with bare keys, quoted string values, in insertion order", () => {
    expect(stringify(makeObject())).toBe("{}");
    expect(
      stringify(
        makeObject([
          ["name", makeString("Ada")],
          ["age", makeNumber(36)],
          ["tags", makeArray([makeString("x")])],
        ]),
      ),
    ).toBe('{ name: "Ada", age: 36, tags: ["x"] }');
  });

  it("renders nested objects inside arrays", () => {
    expect(stringify(makeArray([makeObject([["k", makeNumber(1)]])]))).toBe(
      "[{ k: 1 }]",
    );
  });

  it("renders functions and builtins as readable tags", () => {
    const node = functionNode();
    expect(stringify(makeFunction(node, envStub(), "greet"))).toBe(
      "<fn greet>",
    );
    expect(stringify(makeFunction(node, envStub(), null))).toBe("<fn>");
    expect(stringify(makeBuiltin("len", { min: 1, max: 1 }, noopImpl))).toBe(
      "<builtin len>",
    );
  });

  it.each<[string, string]>([
    ["abc", '"abc"'],
    ['"', '"\\""'],
    ["\\", '"\\\\"'],
    ["\n", '"\\n"'],
    ["\t", '"\\t"'],
    ["\r", '"\\r"'],
    ["\0", '"\\0"'],
    ["é", '"é"'], // printable non-ASCII passes through verbatim
  ])("escapes nested string %j as %j", (raw, quoted) => {
    // Nested position (inside an array) triggers quoting/escaping.
    expect(stringify(makeArray([makeString(raw)]))).toBe(`[${quoted}]`);
  });

  it("escapes a non-printable C0 control character as \\uXXXX", () => {
    const control = String.fromCharCode(0x01);
    expect(stringify(makeArray([makeString(control)]))).toBe('["\\u0001"]');
  });
});

// ── Defensive exhaustiveness guard ───────────────────────────────────────────

describe("exhaustiveness guard", () => {
  it("throws on an unknown value kind in stringify and valuesEqual", () => {
    const bogus = { kind: "mystery" } as unknown as Value;
    expect(() => stringify(bogus)).toThrow(/unhandled ValueKind/);
    expect(() => valuesEqual(bogus, bogus)).toThrow(/unhandled ValueKind/);
  });
});
