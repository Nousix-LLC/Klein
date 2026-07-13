import { describe, it, expect } from "vitest";

import { isAlpha, isAlphaNum, isDigit, isHexDigit } from "../../src/lexer/char";

describe("isDigit", () => {
  it("accepts every decimal digit", () => {
    for (const ch of "0123456789") expect(isDigit(ch)).toBe(true);
  });

  it("rejects non-digits, letters, and the empty string", () => {
    for (const ch of ["a", "F", "_", ".", " ", ""]) {
      expect(isDigit(ch)).toBe(false);
    }
  });
});

describe("isHexDigit", () => {
  it("accepts decimal digits and both letter cases a–f / A–F", () => {
    for (const ch of "0123456789abcdefABCDEF")
      expect(isHexDigit(ch)).toBe(true);
  });

  it("rejects letters outside the hex range and the empty string", () => {
    for (const ch of ["g", "G", "z", "_", ""]) {
      expect(isHexDigit(ch)).toBe(false);
    }
  });
});

describe("isAlpha", () => {
  it("accepts ASCII letters of both cases and underscore", () => {
    for (const ch of ["a", "z", "A", "Z", "_", "m"]) {
      expect(isAlpha(ch)).toBe(true);
    }
  });

  it("rejects digits, punctuation, and the empty string", () => {
    for (const ch of ["0", "9", "$", "-", "", " "]) {
      expect(isAlpha(ch)).toBe(false);
    }
  });
});

describe("isAlphaNum", () => {
  it("accepts letters, underscore, and digits", () => {
    for (const ch of ["a", "Z", "_", "0", "7"]) {
      expect(isAlphaNum(ch)).toBe(true);
    }
  });

  it("rejects punctuation and the empty string", () => {
    for (const ch of [".", "+", "", " "]) expect(isAlphaNum(ch)).toBe(false);
  });
});
