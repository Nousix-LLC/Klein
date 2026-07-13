import { describe, it, expect } from "vitest";

import {
  ErrorCode,
  type Diagnostic,
  type Span,
  type StackFrame,
} from "@contracts";
import { makePosition, makeSpan } from "../../src/core/span";
import {
  KleinErrorBase,
  LexicalError,
  RuntimeErr,
  SyntaxErr,
} from "../../src/core/errors";

const SOURCE = "test.kl";

/** Build a Span [start, end) in SOURCE from two offsets, via the span helpers. */
const span = (startOffset = 0, endOffset = 3): Span =>
  makeSpan(
    makePosition(startOffset, 1, startOffset + 1),
    makePosition(endOffset, 1, endOffset + 1),
    SOURCE,
  );

const FRAMES: readonly StackFrame[] = [
  { functionName: "<script>", span: span(0, 40) },
  { functionName: "main", span: span(10, 20) },
];

describe("LexicalError", () => {
  it("is a real Error subclass and structurally satisfies KleinError", () => {
    const err = new LexicalError(
      ErrorCode.UnterminatedString,
      "unterminated string literal",
      span(4, 9),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KleinErrorBase);
    expect(err).toBeInstanceOf(LexicalError);
    expect(err.name).toBe("LexicalError");
  });

  it("fixes phase='lexical' and carries code + span (structured fields)", () => {
    const s = span(4, 9);
    const err = new LexicalError(ErrorCode.UnexpectedCharacter, "bad char", s);
    expect(err.phase).toBe("lexical");
    expect(err.code).toBe(ErrorCode.UnexpectedCharacter);
    expect(err.span).toBe(s);
  });

  it("toDiagnostic() reduces to the contract Diagnostic shape (no stack)", () => {
    const s = span(4, 9);
    const err = new LexicalError(ErrorCode.InvalidEscape, "bad escape", s);
    const diag: Diagnostic = err.toDiagnostic();
    expect(diag).toEqual({
      severity: "error",
      phase: "lexical",
      code: ErrorCode.InvalidEscape,
      message: err.message,
      span: s,
    });
    expect(diag.stack).toBeUndefined();
    expect("stack" in diag).toBe(false);
  });
});

describe("SyntaxErr", () => {
  it("is a real Error subclass with name and phase='syntax'", () => {
    const err = new SyntaxErr(ErrorCode.ExpectedToken, "expected ')'", span());
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SyntaxErr);
    expect(err.name).toBe("SyntaxErr");
    expect(err.phase).toBe("syntax");
  });

  it("toDiagnostic() keys off ErrorCode and structured fields", () => {
    const s = span(2, 7);
    const err = new SyntaxErr(ErrorCode.UnexpectedToken, "unexpected token", s);
    const diag = err.toDiagnostic();
    expect(diag.severity).toBe("error");
    expect(diag.phase).toBe("syntax");
    expect(diag.code).toBe(ErrorCode.UnexpectedToken);
    expect(diag.span).toBe(s);
    expect(diag.message).toBe(err.message);
  });
});

describe("RuntimeErr", () => {
  it("fixes phase='runtime'; without a call stack there is no diagnostic stack", () => {
    const err = new RuntimeErr(
      ErrorCode.UndefinedVariable,
      "undefined variable 'foo'",
      span(8, 11),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RuntimeErr);
    expect(err.name).toBe("RuntimeErr");
    expect(err.phase).toBe("runtime");
    expect(err.callStack).toBeUndefined();

    const diag = err.toDiagnostic();
    expect(diag.code).toBe(ErrorCode.UndefinedVariable);
    expect(diag.stack).toBeUndefined();
    expect("stack" in diag).toBe(false);
  });

  it("passes an optional Klein call stack through to callStack and the diagnostic", () => {
    const s = span(8, 11);
    const err = new RuntimeErr(
      ErrorCode.StackOverflow,
      "stack overflow",
      s,
      FRAMES,
    );
    expect(err.callStack).toBe(FRAMES);

    const diag = err.toDiagnostic();
    expect(diag.phase).toBe("runtime");
    expect(diag.code).toBe(ErrorCode.StackOverflow);
    expect(diag.span).toBe(s);
    expect(diag.stack).toBe(FRAMES);
    expect(diag.stack).toEqual(FRAMES);
  });

  it("does NOT collide with the native Error.stack (JS trace) property", () => {
    const err = new RuntimeErr(ErrorCode.TypeMismatch, "type mismatch", span());
    // The native Error.stack (a string trace) is untouched by our callStack.
    expect(typeof err.stack === "string" || err.stack === undefined).toBe(true);
  });
});

describe("throw / catch interop", () => {
  it("a thrown RuntimeErr is catchable and carries its span + code", () => {
    const s = span(1, 4);
    let caught: unknown;
    try {
      throw new RuntimeErr(ErrorCode.DivisionByZero, "division by zero", s);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RuntimeErr);
    expect(caught).toBeInstanceOf(Error);
    const err = caught as RuntimeErr;
    expect(err.span).toBe(s);
    expect(err.code).toBe(ErrorCode.DivisionByZero);
  });

  it("Vitest's toThrow matches the concrete class (instanceof-based)", () => {
    expect(() => {
      throw new SyntaxErr(
        ErrorCode.ExpectedExpression,
        "expected expression",
        span(),
      );
    }).toThrow(SyntaxErr);
  });
});
