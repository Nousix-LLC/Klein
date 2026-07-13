/** Tests for the conversion builtins: `str`, `num`, `int`, `bool`, `chars`, `ord`, `chr`. */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { evalKlein, expectErrorCode } from "./harness";

describe("str", () => {
  it("renders any value to its canonical string (total)", () => {
    expect(evalKlein(`str(42);`)).toBe("42");
    expect(evalKlein(`str(null);`)).toBe("null");
    expect(evalKlein(`str(true);`)).toBe("true");
    expect(evalKlein(`str([1, "a"]);`)).toBe(`[1, "a"]`);
    // The result is a string value; concatenation proves it.
    expect(evalKlein(`str(1) + str(2);`)).toBe("12");
  });
});

describe("num", () => {
  it("passes numbers through and maps booleans to 1/0", () => {
    expect(evalKlein(`num(3.5);`)).toBe("3.5");
    expect(evalKlein(`num(true);`)).toBe("1");
    expect(evalKlein(`num(false);`)).toBe("0");
  });

  it("parses numeric strings, ignoring surrounding whitespace", () => {
    expect(evalKlein(`num("42");`)).toBe("42");
    expect(evalKlein(`num("  3.5  ");`)).toBe("3.5");
    expect(evalKlein(`num("1e3");`)).toBe("1000");
    expect(evalKlein(`num("0x1F");`)).toBe("31");
  });

  it("rejects empty/blank and unparseable strings (InvalidOperand)", () => {
    expectErrorCode(`num("");`, ErrorCode.InvalidOperand);
    expectErrorCode(`num("   ");`, ErrorCode.InvalidOperand);
    expectErrorCode(`num("abc");`, ErrorCode.InvalidOperand);
    expectErrorCode(`num("1,000");`, ErrorCode.InvalidOperand);
  });

  it("rejects unconvertible kinds (TypeMismatch)", () => {
    expectErrorCode(`num(null);`, ErrorCode.TypeMismatch);
    expectErrorCode(`num([1]);`, ErrorCode.TypeMismatch);
    expectErrorCode(`num({});`, ErrorCode.TypeMismatch);
  });
});

describe("int", () => {
  it("truncates toward zero", () => {
    expect(evalKlein(`int(3.9);`)).toBe("3");
    expect(evalKlein(`int(-3.9);`)).toBe("-3");
    expect(evalKlein(`int("7.8");`)).toBe("7");
    expect(evalKlein(`int(true);`)).toBe("1");
  });

  it("rejects non-finite results (InvalidOperand) and bad kinds (TypeMismatch)", () => {
    // Non-finite via a string parse, and via an already-Infinity number value.
    expectErrorCode(`int("Infinity");`, ErrorCode.InvalidOperand);
    expectErrorCode(`int(num("Infinity"));`, ErrorCode.InvalidOperand);
    expectErrorCode(`int(null);`, ErrorCode.TypeMismatch);
  });
});

describe("bool", () => {
  it("applies Klein truthiness (only null and false are falsy)", () => {
    expect(evalKlein(`bool(0);`)).toBe("true");
    expect(evalKlein(`bool("");`)).toBe("true");
    expect(evalKlein(`bool([]);`)).toBe("true");
    expect(evalKlein(`bool(null);`)).toBe("false");
    expect(evalKlein(`bool(false);`)).toBe("false");
  });
});

describe("chars", () => {
  it("splits a string into code-point characters", () => {
    expect(evalKlein(`chars("abc");`)).toBe(`["a", "b", "c"]`);
    expect(evalKlein(`chars("");`)).toBe("[]");
    expect(evalKlein(`chars("a\u{1F600}");`)).toBe(`["a", "\u{1F600}"]`);
  });

  it("rejects a non-string (TypeMismatch)", () => {
    expectErrorCode(`chars(1);`, ErrorCode.TypeMismatch);
  });
});

describe("ord and chr", () => {
  it("round-trips a code point", () => {
    expect(evalKlein(`ord("A");`)).toBe("65");
    expect(evalKlein(`chr(65);`)).toBe("A");
    expect(evalKlein(`chr(ord("z"));`)).toBe("z");
    expect(evalKlein(`ord("\u{1F600}");`)).toBe("128512");
  });

  it("ord rejects non-single-character strings (InvalidOperand)", () => {
    expectErrorCode(`ord("");`, ErrorCode.InvalidOperand);
    expectErrorCode(`ord("ab");`, ErrorCode.InvalidOperand);
  });

  it("ord rejects a non-string and chr a non-number (TypeMismatch)", () => {
    expectErrorCode(`ord(1);`, ErrorCode.TypeMismatch);
    expectErrorCode(`chr("A");`, ErrorCode.TypeMismatch);
  });

  it("chr rejects non-integer or out-of-range code points (InvalidOperand)", () => {
    expectErrorCode(`chr(3.5);`, ErrorCode.InvalidOperand);
    expectErrorCode(`chr(-1);`, ErrorCode.InvalidOperand);
    expectErrorCode(`chr(1114112);`, ErrorCode.InvalidOperand);
  });
});
