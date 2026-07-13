/** Tests for the diagnostic builtins: `assert`, `error`, `clock`. */

import { describe, expect, it } from "vitest";

import { ErrorCode, ValueKind } from "@contracts";

import { evalKlein, expectErrorCode, runKlein } from "./harness";

describe("assert", () => {
  it("returns null and does not fault when the condition is truthy", () => {
    expect(evalKlein(`assert(true);`)).toBe("null");
    expect(evalKlein(`assert(1);`)).toBe("null");
    expect(evalKlein(`assert("non-empty", "with a message");`)).toBe("null");
  });

  it("faults with AssertionFailed when the condition is falsy", () => {
    expectErrorCode(`assert(false);`, ErrorCode.AssertionFailed);
    expectErrorCode(`assert(null);`, ErrorCode.AssertionFailed);
    expectErrorCode(`assert(1 == 2, "math broke");`, ErrorCode.AssertionFailed);
  });

  it("anchors the fault with a runtime call stack", () => {
    const error = expectErrorCode(`assert(false);`, ErrorCode.AssertionFailed);
    expect(error.callStack).toBeDefined();
    expect((error.callStack ?? []).length).toBeGreaterThan(0);
  });
});

describe("error", () => {
  it("always raises UserError with the given message", () => {
    expectErrorCode(`error("boom");`, ErrorCode.UserError);
    expectErrorCode(
      `let f = fn() { error("nested"); }; f();`,
      ErrorCode.UserError,
    );
  });

  it("rejects a non-string message (TypeMismatch)", () => {
    expectErrorCode(`error(42);`, ErrorCode.TypeMismatch);
  });
});

describe("clock", () => {
  it("returns a non-negative number of seconds", () => {
    const { value } = runKlein(`clock();`);
    expect(value.kind).toBe(ValueKind.Number);
    if (value.kind === ValueKind.Number) {
      expect(value.value).toBeGreaterThan(0);
    }
  });

  it("enforces zero arity (WrongArgumentCount)", () => {
    expectErrorCode(`clock(1);`, ErrorCode.WrongArgumentCount);
  });
});
