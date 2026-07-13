/** Tests for the inspection builtins: `len`, `type`, `keys`, `values`, `has`, `contains`. */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { evalKlein, expectErrorCode } from "./harness";

describe("len", () => {
  it("counts array elements, object entries, and string code points", () => {
    expect(evalKlein(`len([1, 2, 3]);`)).toBe("3");
    expect(evalKlein(`len([]);`)).toBe("0");
    expect(evalKlein(`let o = { a: 1, b: 2 }; len(o);`)).toBe("2");
    expect(evalKlein(`len("hello");`)).toBe("5");
    expect(evalKlein(`len("");`)).toBe("0");
  });

  it("counts astral characters as one code point each", () => {
    expect(evalKlein(`len("a\u{1F600}b");`)).toBe("3");
  });

  it("rejects a kind with no length (TypeMismatch)", () => {
    expectErrorCode(`len(1);`, ErrorCode.TypeMismatch);
    expectErrorCode(`len(true);`, ErrorCode.TypeMismatch);
    expectErrorCode(`len(null);`, ErrorCode.TypeMismatch);
  });

  it("enforces arity (WrongArgumentCount)", () => {
    expectErrorCode(`len();`, ErrorCode.WrongArgumentCount);
    expectErrorCode(`len([1], [2]);`, ErrorCode.WrongArgumentCount);
  });
});

describe("type", () => {
  it("returns the value kind as a string", () => {
    expect(evalKlein(`type(null);`)).toBe("null");
    expect(evalKlein(`type(true);`)).toBe("boolean");
    expect(evalKlein(`type(1);`)).toBe("number");
    expect(evalKlein(`type("s");`)).toBe("string");
    expect(evalKlein(`type([1]);`)).toBe("array");
    expect(evalKlein(`type({ a: 1 });`)).toBe("object");
    expect(evalKlein(`type(fn() {});`)).toBe("function");
    expect(evalKlein(`type(len);`)).toBe("builtin");
  });
});

describe("keys and values", () => {
  it("returns keys and values in insertion order", () => {
    expect(evalKlein(`keys({ b: 1, a: 2, c: 3 });`)).toBe(`["b", "a", "c"]`);
    expect(evalKlein(`values({ b: 1, a: 2, c: 3 });`)).toBe("[1, 2, 3]");
    expect(evalKlein(`keys({});`)).toBe("[]");
  });

  it("returns a fresh array that does not alias the object", () => {
    // Mutating the returned array leaves the object's own entries intact.
    expect(
      evalKlein(`let o = { a: 1 }; let vs = values(o); push(vs, 2); len(o);`),
    ).toBe("1");
  });

  it("rejects a non-object (TypeMismatch)", () => {
    expectErrorCode(`keys([1, 2]);`, ErrorCode.TypeMismatch);
    expectErrorCode(`values("s");`, ErrorCode.TypeMismatch);
  });
});

describe("has", () => {
  it("reports whether a key is present", () => {
    expect(evalKlein(`has({ a: 1 }, "a");`)).toBe("true");
    expect(evalKlein(`has({ a: 1 }, "b");`)).toBe("false");
  });

  it("rejects a non-object receiver or non-string key (TypeMismatch)", () => {
    expectErrorCode(`has([1], "a");`, ErrorCode.TypeMismatch);
    expectErrorCode(`has({ a: 1 }, 1);`, ErrorCode.TypeMismatch);
  });
});

describe("contains", () => {
  it("tests array membership by structural equality of primitives", () => {
    expect(evalKlein(`contains([1, 2, 3], 2);`)).toBe("true");
    expect(evalKlein(`contains([1, 2, 3], 9);`)).toBe("false");
    expect(evalKlein(`contains(["a", "b"], "b");`)).toBe("true");
  });

  it("uses reference identity for compound members", () => {
    // Two structurally-equal but distinct arrays are not equal members.
    expect(evalKlein(`contains([[1]], [1]);`)).toBe("false");
    expect(evalKlein(`let x = [1]; contains([x], x);`)).toBe("true");
  });

  it("tests substring containment for strings", () => {
    expect(evalKlein(`contains("hello", "ell");`)).toBe("true");
    expect(evalKlein(`contains("hello", "z");`)).toBe("false");
  });

  it("rejects an unsupported container or a non-string needle (TypeMismatch)", () => {
    expectErrorCode(`contains({ a: 1 }, "a");`, ErrorCode.TypeMismatch);
    expectErrorCode(`contains("hi", 1);`, ErrorCode.TypeMismatch);
  });
});
