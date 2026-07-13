/**
 * Tests for the collection builtins: `push`, `pop`, `slice`, `range`, `map`,
 * `filter`, `reduce`, `sort`, `join`, `split`.
 *
 * The higher-order builtins are driven with **real user closures** (function
 * literals and captured-variable closures) invoked through the interpreter, per
 * the stdlib brief.
 */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { evalKlein, expectErrorCode } from "./harness";

describe("push", () => {
  it("mutates the array in place (reference semantics) and returns it", () => {
    expect(evalKlein(`let a = [1]; push(a, 2, 3); a;`)).toBe("[1, 2, 3]");
    // Aliases observe the mutation.
    expect(evalKlein(`let a = [1]; let b = a; push(a, 2); b;`)).toBe("[1, 2]");
    // Return value is the same array.
    expect(evalKlein(`len(push([], 1, 2, 3));`)).toBe("3");
  });

  it("requires an array and at least one item to push", () => {
    expectErrorCode(`push(1, 2);`, ErrorCode.TypeMismatch);
    expectErrorCode(`push([1]);`, ErrorCode.WrongArgumentCount);
  });
});

describe("pop", () => {
  it("removes and returns the last element", () => {
    expect(evalKlein(`let a = [1, 2, 3]; pop(a);`)).toBe("3");
    expect(evalKlein(`let a = [1, 2, 3]; pop(a); a;`)).toBe("[1, 2]");
  });

  it("faults on an empty array (InvalidOperand) and a non-array (TypeMismatch)", () => {
    expectErrorCode(`pop([]);`, ErrorCode.InvalidOperand);
    expectErrorCode(`pop("s");`, ErrorCode.TypeMismatch);
  });
});

describe("slice", () => {
  it("returns a fresh sub-array without mutating the source", () => {
    expect(evalKlein(`slice([1, 2, 3, 4], 1, 3);`)).toBe("[2, 3]");
    expect(evalKlein(`slice([1, 2, 3, 4], 2);`)).toBe("[3, 4]");
    expect(evalKlein(`let a = [1, 2, 3]; slice(a, 0, 1); a;`)).toBe(
      "[1, 2, 3]",
    );
  });

  it("supports negative indices and clamps out-of-range bounds", () => {
    expect(evalKlein(`slice([1, 2, 3, 4], -2);`)).toBe("[3, 4]");
    expect(evalKlein(`slice([1, 2, 3], 0, 99);`)).toBe("[1, 2, 3]");
    expect(evalKlein(`slice([1, 2, 3], 2, 1);`)).toBe("[]");
  });

  it("slices strings by code point", () => {
    expect(evalKlein(`slice("hello", 1, 4);`)).toBe("ell");
    expect(evalKlein(`slice("a\u{1F600}b", 1, 2);`)).toBe("\u{1F600}");
  });

  it("faults on a bad sequence, index kind, or non-integer index", () => {
    expectErrorCode(`slice(1, 0);`, ErrorCode.TypeMismatch);
    expectErrorCode(`slice([1, 2], "0");`, ErrorCode.TypeMismatch);
    expectErrorCode(`slice([1, 2], 0.5);`, ErrorCode.InvalidOperand);
  });
});

describe("range", () => {
  it("generates arithmetic sequences", () => {
    expect(evalKlein(`range(3);`)).toBe("[0, 1, 2]");
    expect(evalKlein(`range(2, 5);`)).toBe("[2, 3, 4]");
    expect(evalKlein(`range(0, 10, 3);`)).toBe("[0, 3, 6, 9]");
    expect(evalKlein(`range(5, 0, -2);`)).toBe("[5, 3, 1]");
    expect(evalKlein(`range(0);`)).toBe("[]");
  });

  it("faults on a zero step (InvalidOperand) or non-integer bound", () => {
    expectErrorCode(`range(0, 10, 0);`, ErrorCode.InvalidOperand);
    expectErrorCode(`range(1.5);`, ErrorCode.InvalidOperand);
    expectErrorCode(`range("3");`, ErrorCode.TypeMismatch);
  });
});

describe("map", () => {
  it("applies a function literal to each element", () => {
    expect(evalKlein(`map([1, 2, 3], fn(x) { return x * 2; });`)).toBe(
      "[2, 4, 6]",
    );
  });

  it("invokes a real closure that captures its defining scope", () => {
    expect(
      evalKlein(`let n = 10; map([1, 2, 3], fn(x) { return x + n; });`),
    ).toBe("[11, 12, 13]");
  });

  it("propagates a callback fault and callee faults through the interpreter", () => {
    expectErrorCode(`map([1], 5);`, ErrorCode.NotCallable);
    expectErrorCode(
      `map([1, 2], fn(a, b) { return a; });`,
      ErrorCode.WrongArgumentCount,
    );
    expectErrorCode(`map(1, fn(x) { return x; });`, ErrorCode.TypeMismatch);
  });
});

describe("filter", () => {
  it("keeps elements for which the predicate is truthy", () => {
    expect(
      evalKlein(`filter([1, 2, 3, 4], fn(x) { return x % 2 == 0; });`),
    ).toBe("[2, 4]");
    // Klein truthiness: a non-boolean truthy result keeps the element.
    expect(evalKlein(`filter([0, 1, 2], fn(x) { return x; });`)).toBe(
      "[0, 1, 2]",
    );
  });

  it("rejects a non-array (TypeMismatch)", () => {
    expectErrorCode(
      `filter("s", fn(x) { return x; });`,
      ErrorCode.TypeMismatch,
    );
  });
});

describe("reduce", () => {
  it("folds left with a two-argument reducer and an initial value", () => {
    expect(
      evalKlein(`reduce([1, 2, 3, 4], fn(a, b) { return a + b; }, 0);`),
    ).toBe("10");
    expect(evalKlein(`reduce([], fn(a, b) { return a + b; }, 42);`)).toBe("42");
    // Build a string, proving accumulator threading.
    expect(
      evalKlein(`reduce(["a", "b", "c"], fn(a, b) { return a + b; }, "");`),
    ).toBe("abc");
  });

  it("rejects a non-array (TypeMismatch)", () => {
    expectErrorCode(
      `reduce(1, fn(a, b) { return a; }, 0);`,
      ErrorCode.TypeMismatch,
    );
  });
});

describe("sort", () => {
  it("sorts numbers and strings by natural order without a comparator", () => {
    expect(evalKlein(`sort([3, 1, 2]);`)).toBe("[1, 2, 3]");
    expect(evalKlein(`sort([10, 2, 1]);`)).toBe("[1, 2, 10]"); // numeric, not lexical
    expect(evalKlein(`sort(["b", "a", "c"]);`)).toBe(`["a", "b", "c"]`);
    // Equal strings compare as equal (stable, order preserved).
    expect(evalKlein(`sort(["a", "a"]);`)).toBe(`["a", "a"]`);
    expect(evalKlein(`sort([]);`)).toBe("[]");
  });

  it("does not mutate its input", () => {
    expect(evalKlein(`let a = [3, 1, 2]; sort(a); a;`)).toBe("[3, 1, 2]");
  });

  it("sorts with a user comparator (real closure)", () => {
    expect(evalKlein(`sort([3, 1, 2], fn(a, b) { return b - a; });`)).toBe(
      "[3, 2, 1]",
    );
  });

  it("rejects a mixed/unorderable array without a comparator (InvalidOperand)", () => {
    expectErrorCode(`sort([1, "a"]);`, ErrorCode.InvalidOperand);
    expectErrorCode(`sort([null, null]);`, ErrorCode.InvalidOperand);
  });

  it("faults when the comparator returns a non-number (TypeMismatch)", () => {
    expectErrorCode(
      `sort([2, 1], fn(a, b) { return "x"; });`,
      ErrorCode.TypeMismatch,
    );
  });
});

describe("join", () => {
  it("joins array elements with an optional separator", () => {
    expect(evalKlein(`join([1, 2, 3], "-");`)).toBe("1-2-3");
    expect(evalKlein(`join(["a", "b"]);`)).toBe("ab");
    expect(evalKlein(`join([]);`)).toBe("");
    // Elements render raw (top-level), not quoted.
    expect(evalKlein(`join(["a", "b"], ", ");`)).toBe("a, b");
  });

  it("rejects a non-array or non-string separator (TypeMismatch)", () => {
    expectErrorCode(`join("s", "-");`, ErrorCode.TypeMismatch);
    expectErrorCode(`join([1, 2], 3);`, ErrorCode.TypeMismatch);
  });
});

describe("split", () => {
  it("splits on a separator, or into characters when empty", () => {
    expect(evalKlein(`split("a,b,c", ",");`)).toBe(`["a", "b", "c"]`);
    expect(evalKlein(`split("abc", "");`)).toBe(`["a", "b", "c"]`);
    expect(evalKlein(`split("abc");`)).toBe(`["a", "b", "c"]`);
  });

  it("rejects non-string arguments (TypeMismatch)", () => {
    expectErrorCode(`split(1, ",");`, ErrorCode.TypeMismatch);
    expectErrorCode(`split("a,b", 1);`, ErrorCode.TypeMismatch);
  });
});
