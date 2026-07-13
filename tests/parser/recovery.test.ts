/**
 * Error-recovery tests. The parser is error-tolerant: it records a stable
 * `ErrorCode` and synchronizes to the next statement boundary, so one pass
 * surfaces many independent syntax errors and still returns a (partial) program.
 *
 * Every assertion keys off `ErrorCode` — never message text — per the project
 * quality bar. These tests also lock in the two *locally* recovered faults
 * (invalid assignment target, duplicate parameter), which are diagnosed in place
 * without discarding the surrounding statement.
 */

import { describe, it, expect } from "vitest";

import { ErrorCode } from "@contracts";
import { errorCodes, parse } from "./helpers";

describe("expected-token faults", () => {
  it("reports ExpectedToken for a missing identifier after let", () => {
    expect(errorCodes("let = 5;")).toContain(ErrorCode.ExpectedToken);
  });

  it("reports ExpectedToken for a missing initializer '='", () => {
    expect(errorCodes("let x 5;")).toContain(ErrorCode.ExpectedToken);
  });

  it("reports ExpectedToken for a missing semicolon at end of input", () => {
    expect(errorCodes("let x = 5")).toContain(ErrorCode.ExpectedToken);
  });

  it("reports ExpectedToken for an unclosed grouping / call / array / block", () => {
    expect(errorCodes("(1 + 2;")).toContain(ErrorCode.ExpectedToken);
    expect(errorCodes("f(a, b;")).toContain(ErrorCode.ExpectedToken);
    expect(errorCodes("let a = [1, 2;")).toContain(ErrorCode.ExpectedToken);
    expect(errorCodes("{ a; ")).toContain(ErrorCode.ExpectedToken);
  });

  it("reports ExpectedToken for a non-key in an object literal", () => {
    expect(errorCodes("let o = { 1: 2 };")).toContain(ErrorCode.ExpectedToken);
  });

  it("reports ExpectedToken for a member access without a name", () => {
    expect(errorCodes("o.;")).toContain(ErrorCode.ExpectedToken);
  });
});

describe("expected-expression faults", () => {
  it("reports ExpectedExpression when an operand is missing (found token)", () => {
    expect(errorCodes("let x = + 1;")).toContain(ErrorCode.ExpectedExpression);
  });

  it("reports ExpectedExpression when the operand is missing at end of input", () => {
    expect(errorCodes("1 +")).toContain(ErrorCode.ExpectedExpression);
  });
});

describe("invalid assignment target", () => {
  it("reports InvalidAssignmentTarget for a literal LHS", () => {
    expect(errorCodes("1 = x;")).toContain(ErrorCode.InvalidAssignmentTarget);
  });

  it("reports InvalidAssignmentTarget for a call LHS", () => {
    expect(errorCodes("f() = x;")).toContain(ErrorCode.InvalidAssignmentTarget);
  });

  it("reports InvalidAssignmentTarget for a computed binary LHS", () => {
    expect(errorCodes("a + b = c;")).toContain(
      ErrorCode.InvalidAssignmentTarget,
    );
  });

  it("recovers locally: the surrounding program keeps parsing", () => {
    const { program, errors } = parse("1 = x; let y = 2;");
    expect(errors.map((e) => e.code)).toContain(
      ErrorCode.InvalidAssignmentTarget,
    );
    // The following well-formed statement is still parsed.
    expect(program.body.some((s) => s.kind === "LetStatement")).toBe(true);
  });
});

describe("duplicate parameter", () => {
  it("reports DuplicateParameter in a function declaration", () => {
    expect(errorCodes("fn f(a, a) { return a; }")).toContain(
      ErrorCode.DuplicateParameter,
    );
  });

  it("reports DuplicateParameter in a function literal", () => {
    expect(errorCodes("let g = fn(x, x) { return x; };")).toContain(
      ErrorCode.DuplicateParameter,
    );
  });

  it("keeps the parameter list de-duplicated after recovery", () => {
    const { program, errors } = parse("fn f(a, a, b) { }");
    expect(errors.map((e) => e.code)).toEqual([ErrorCode.DuplicateParameter]);
    const decl = program.body[0];
    expect(decl?.kind).toBe("FunctionDeclaration");
    if (decl?.kind === "FunctionDeclaration") {
      expect(decl.params.map((p) => p.name)).toEqual(["a", "b"]);
    }
  });
});

describe("multi-error recovery in one pass", () => {
  it("surfaces several independent errors and still parses good statements", () => {
    const src = "let x = ;\nlet y = 2;\nlet z = ;\nlet w = 4;";
    const { program, errors } = parse(src);
    // Two ExpectedExpression faults (lines 1 and 3), reported together.
    const expected = errors.filter(
      (e) => e.code === ErrorCode.ExpectedExpression,
    );
    expect(expected.length).toBeGreaterThanOrEqual(2);
    // The two well-formed bindings (y and w) survive recovery.
    const names = program.body
      .filter((s) => s.kind === "LetStatement")
      .map((s) => (s.kind === "LetStatement" ? s.name : ""));
    expect(names).toEqual(expect.arrayContaining(["y", "w"]));
  });

  it("synchronizes to the next statement after a mid-block error", () => {
    const { program, errors } = parse("{ let a = ; let b = 2; }");
    expect(errors.map((e) => e.code)).toContain(ErrorCode.ExpectedExpression);
    const block = program.body[0];
    expect(block?.kind).toBe("BlockStatement");
    if (block?.kind === "BlockStatement") {
      // `b` recovered inside the same block.
      expect(
        block.statements.some(
          (s) => s.kind === "LetStatement" && s.name === "b",
        ),
      ).toBe(true);
    }
  });

  it("always returns a Program even for badly broken input", () => {
    const { program } = parse(")(*&");
    expect(program.kind).toBe("Program");
  });
});
