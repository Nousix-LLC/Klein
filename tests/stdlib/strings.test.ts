/** Tests for the string builtins: `upper`, `lower`, `trim`. */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { evalKlein, expectErrorCode } from "./harness";

describe("upper / lower", () => {
  it("changes case", () => {
    expect(evalKlein(`upper("hello");`)).toBe("HELLO");
    expect(evalKlein(`lower("HeLLo");`)).toBe("hello");
    expect(evalKlein(`upper("");`)).toBe("");
  });

  it("rejects non-strings (TypeMismatch)", () => {
    expectErrorCode(`upper(1);`, ErrorCode.TypeMismatch);
    expectErrorCode(`lower([1]);`, ErrorCode.TypeMismatch);
  });
});

describe("trim", () => {
  it("removes leading and trailing whitespace only", () => {
    expect(evalKlein(`trim("  hi  ");`)).toBe("hi");
    // Double-escaped so the Klein source carries the escape sequences \n \t
    // (a single backslash-n in a JS template would be a real newline).
    expect(evalKlein(`trim("\\n\\t x \\t\\n");`)).toBe("x");
    expect(evalKlein(`trim("a b");`)).toBe("a b");
  });

  it("rejects a non-string (TypeMismatch)", () => {
    expectErrorCode(`trim(null);`, ErrorCode.TypeMismatch);
  });
});
