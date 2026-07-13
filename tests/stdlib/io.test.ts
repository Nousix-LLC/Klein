/** Tests for the I/O builtins: `print`, `println`. */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { evalKlein, expectErrorCode, outputOf } from "./harness";

describe("print", () => {
  it("writes its arguments space-separated with no trailing newline", () => {
    expect(outputOf(`print("a", "b", 1);`)).toBe("a b 1");
  });

  it("writes nothing for no arguments and returns null", () => {
    expect(outputOf(`print();`)).toBe("");
    expect(evalKlein(`print("x");`)).toBe("null");
  });

  it("renders top-level strings raw but nested strings quoted", () => {
    expect(outputOf(`print("hi", [1, "a"]);`)).toBe(`hi [1, "a"]`);
  });

  it("renders every value kind through the canonical stringifier", () => {
    expect(outputOf(`print(null, true, 3.5);`)).toBe("null true 3.5");
  });
});

describe("println", () => {
  it("appends a single trailing newline", () => {
    expect(outputOf(`println("hi");`)).toBe("hi\n");
    expect(outputOf(`println();`)).toBe("\n");
  });

  it("accumulates across multiple calls", () => {
    expect(outputOf(`println("a"); println("b");`)).toBe("a\nb\n");
  });

  it("is arity-unbounded, so a huge call is not an arity error", () => {
    expect(outputOf(`println(1, 2, 3, 4, 5);`)).toBe("1 2 3 4 5\n");
  });
});

describe("print does not fault", () => {
  it("accepts any value kind without a type error", () => {
    // A function value is printable; no builtin here rejects a kind.
    expect(outputOf(`print(fn(x) { return x; });`)).toBe("<fn>");
    // Sanity: an unrelated fault (undefined variable) is still a RuntimeErr.
    expectErrorCode(`print(nope);`, ErrorCode.UndefinedVariable);
  });
});
