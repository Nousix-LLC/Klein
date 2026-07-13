/** Tests for the math builtins: `abs`, `floor`, `ceil`, `round`, `sqrt`, `min`, `max`, `pow`. */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { evalKlein, expectErrorCode } from "./harness";

describe("unary math", () => {
  it("computes abs, floor, ceil, round, sqrt", () => {
    expect(evalKlein(`abs(-3.5);`)).toBe("3.5");
    expect(evalKlein(`abs(3.5);`)).toBe("3.5");
    expect(evalKlein(`floor(3.9);`)).toBe("3");
    expect(evalKlein(`floor(-3.1);`)).toBe("-4");
    expect(evalKlein(`ceil(3.1);`)).toBe("4");
    expect(evalKlein(`round(2.5);`)).toBe("3");
    expect(evalKlein(`round(2.4);`)).toBe("2");
    expect(evalKlein(`sqrt(9);`)).toBe("3");
  });

  it("yields NaN (not a fault) for sqrt of a negative", () => {
    expect(evalKlein(`sqrt(-1);`)).toBe("NaN");
  });

  it("rejects non-numbers (TypeMismatch)", () => {
    expectErrorCode(`abs("x");`, ErrorCode.TypeMismatch);
    expectErrorCode(`floor(null);`, ErrorCode.TypeMismatch);
    expectErrorCode(`sqrt([1]);`, ErrorCode.TypeMismatch);
  });
});

describe("min / max", () => {
  it("selects the extreme of one or more numbers", () => {
    expect(evalKlein(`min(3, 1, 2);`)).toBe("1");
    expect(evalKlein(`max(3, 1, 2);`)).toBe("3");
    expect(evalKlein(`min(42);`)).toBe("42");
    expect(evalKlein(`max(-1, -5);`)).toBe("-1");
  });

  it("requires at least one argument and rejects non-numbers", () => {
    expectErrorCode(`min();`, ErrorCode.WrongArgumentCount);
    expectErrorCode(`max(1, "x");`, ErrorCode.TypeMismatch);
  });
});

describe("pow", () => {
  it("raises a base to an exponent", () => {
    expect(evalKlein(`pow(2, 10);`)).toBe("1024");
    expect(evalKlein(`pow(9, 0.5);`)).toBe("3");
    expect(evalKlein(`pow(2, -1);`)).toBe("0.5");
  });

  it("rejects non-number operands and enforces arity", () => {
    expectErrorCode(`pow("2", 3);`, ErrorCode.TypeMismatch);
    expectErrorCode(`pow(2, "3");`, ErrorCode.TypeMismatch);
    expectErrorCode(`pow(2);`, ErrorCode.WrongArgumentCount);
  });
});
