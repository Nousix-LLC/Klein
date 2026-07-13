import { describe, it, expect } from "vitest";
import { ErrorCode } from "@contracts";
import type { Diagnostic, Position, Span, StackFrame } from "@contracts";
import {
  DiagnosticFmt,
  diagnosticFormatter,
  formatDiagnostic,
} from "../../src/core/diagnostic";

// ANSI escape (built without a control char in a regex, so `no-control-regex`
// stays happy).
const ESC = String.fromCharCode(27);

const pos = (offset: number, line: number, column: number): Position => ({
  offset,
  line,
  column,
});

const mkSpan = (
  start: Position,
  end: Position,
  source = "script.kl",
): Span => ({
  start,
  end,
  source,
});

describe("DiagnosticFmt — snippet + caret layout", () => {
  it("renders a single-line span with the exact rustc-style layout", () => {
    // "let y = foo + 1;"  → `foo` occupies 1-based columns 9..11 (end excl. 12).
    const src = "let x = 1;\nlet y = foo + 1;\n";
    const d: Diagnostic = {
      severity: "error",
      phase: "runtime",
      code: ErrorCode.UndefinedVariable,
      message: "undefined variable 'foo'",
      span: mkSpan(pos(19, 2, 9), pos(22, 2, 12)),
    };
    const expected = [
      "error[E3001]: undefined variable 'foo'",
      " --> script.kl:2:9",
      "  |",
      "2 | let y = foo + 1;",
      "  |" + " ".repeat(9) + "^^^",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("underlines every covered line of a multi-line span", () => {
    // line 2 "  return a +": `a +` at cols 10..12; line 3 "    b;": `b` at col 5.
    const src = "fn f() {\n  return a +\n    b;\n}";
    const d: Diagnostic = {
      severity: "error",
      phase: "syntax",
      code: ErrorCode.ExpectedExpression,
      message: "expected expression after operator",
      span: mkSpan(pos(19, 2, 10), pos(34, 3, 6), "ex.kl"),
    };
    const expected = [
      "error[E2003]: expected expression after operator",
      " --> ex.kl:2:10",
      "  |",
      "2 |   return a +",
      "  |" + " ".repeat(10) + "^^^",
      "3 |     b;",
      "  |" + " ".repeat(1) + "^^^^^",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("renders a zero-width / point span as a single caret", () => {
    const src = "x";
    const d: Diagnostic = {
      severity: "error",
      phase: "lexical",
      code: ErrorCode.UnexpectedCharacter,
      message: "unexpected token here",
      span: mkSpan(pos(0, 1, 1), pos(0, 1, 1), "p.kl"),
    };
    const expected = [
      "error[E1001]: unexpected token here",
      " --> p.kl:1:1",
      "  |",
      "1 | x",
      "  |" + " ".repeat(1) + "^",
    ].join("\n");
    expect(new DiagnosticFmt().format(d, src)).toBe(expected);
  });

  it("handles a span anchored at line 1, column 1", () => {
    const src = "abc\ndef";
    const d: Diagnostic = {
      severity: "error",
      phase: "syntax",
      code: ErrorCode.UnexpectedToken,
      message: "unexpected token",
      span: mkSpan(pos(0, 1, 1), pos(3, 1, 4), "d.kl"),
    };
    const expected = [
      "error[E2001]: unexpected token",
      " --> d.kl:1:1",
      "  |",
      "1 | abc",
      "  |" + " ".repeat(1) + "^^^",
    ].join("\n");
    expect(diagnosticFormatter.format(d, src)).toBe(expected);
  });

  it("backs off the last line when a multi-line span ends at column 1", () => {
    // Span covers all of line 1 and ends at the start of line 2 (half-open),
    // so only line 1 is underlined.
    const src = "ab\ncd\n";
    const d: Diagnostic = {
      severity: "error",
      phase: "lexical",
      code: ErrorCode.UnterminatedString,
      message: "unterminated string",
      span: mkSpan(pos(0, 1, 1), pos(3, 2, 1), "s.kl"),
    };
    const expected = [
      "error[E1002]: unterminated string",
      " --> s.kl:1:1",
      "  |",
      "1 | ab",
      "  |" + " ".repeat(1) + "^^",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("degrades gracefully (no throw) for an out-of-range span", () => {
    const src = "one line";
    const d: Diagnostic = {
      severity: "error",
      phase: "runtime",
      code: ErrorCode.IndexOutOfRange,
      message: "index out of range",
      span: mkSpan(pos(99, 5, 1), pos(101, 5, 3), "oor.kl"),
    };
    const expected = [
      "error[E3005]: index out of range",
      " --> oor.kl:5:1",
      "  |",
      "  | (source unavailable for this span)",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("appends runtime stack frames, innermost last", () => {
    // line 2 "  boom();": `boom` at cols 3..6 (end excl. 7).
    const src = "fn main() {\n  boom();\n}";
    const frames: StackFrame[] = [
      {
        functionName: "<script>",
        span: mkSpan(pos(0, 1, 1), pos(0, 1, 1), "t.kl"),
      },
      {
        functionName: "main",
        span: mkSpan(pos(14, 2, 3), pos(18, 2, 7), "t.kl"),
      },
    ];
    const d: Diagnostic = {
      severity: "error",
      phase: "runtime",
      code: ErrorCode.NotCallable,
      message: "'boom' is not a function",
      span: mkSpan(pos(14, 2, 3), pos(18, 2, 7), "t.kl"),
      stack: frames,
    };
    const expected = [
      "error[E3003]: 'boom' is not a function",
      " --> t.kl:2:3",
      "  |",
      "2 |   boom();",
      "  |" + " ".repeat(3) + "^^^^",
      "stack traceback (innermost last):",
      "    at <script> (t.kl:1:1)",
      "    at main (t.kl:2:3)",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("renders a `warning` severity header", () => {
    const src = "/* unterminated";
    const d: Diagnostic = {
      severity: "warning",
      phase: "lexical",
      code: ErrorCode.UnterminatedComment,
      message: "comment not closed",
      span: mkSpan(pos(0, 1, 1), pos(2, 1, 3), "w.kl"),
    };
    const out = formatDiagnostic(d, src);
    const firstLine = out.split("\n")[0];
    expect(firstLine).toBe("warning[E1005]: comment not closed");
    expect(out).toContain("^^");
  });

  it("underlines interior lines fully across a 3+ line span", () => {
    const src = "one\ntwo\nthree\nfour";
    const d: Diagnostic = {
      severity: "error",
      phase: "syntax",
      code: ErrorCode.InvalidAssignmentTarget,
      message: "invalid assignment target",
      span: mkSpan(pos(1, 1, 2), pos(11, 3, 4), "m.kl"),
    };
    const expected = [
      "error[E2004]: invalid assignment target",
      " --> m.kl:1:2",
      "  |",
      "1 | one",
      "  |" + " ".repeat(2) + "^^",
      "2 | two",
      "  |" + " ".repeat(1) + "^^^",
      "3 | three",
      "  |" + " ".repeat(1) + "^^^",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("does not throw on a malformed span whose end precedes its start", () => {
    const src = "alpha\nbeta";
    const d: Diagnostic = {
      severity: "error",
      phase: "runtime",
      code: ErrorCode.TypeMismatch,
      message: "type mismatch",
      span: mkSpan(pos(8, 2, 2), pos(0, 1, 1), "bad.kl"),
    };
    const expected = [
      "error[E3002]: type mismatch",
      " --> bad.kl:2:2",
      "  |",
      "2 | beta",
      "  |" + " ".repeat(2) + "^^^",
    ].join("\n");
    expect(formatDiagnostic(d, src)).toBe(expected);
  });

  it("omits the stack section when `stack` is present but empty", () => {
    const src = "let z = 1;";
    const d: Diagnostic = {
      severity: "error",
      phase: "runtime",
      code: ErrorCode.DivisionByZero,
      message: "division by zero",
      span: mkSpan(pos(8, 1, 9), pos(9, 1, 10), "z.kl"),
      stack: [],
    };
    expect(formatDiagnostic(d, src)).not.toContain("stack traceback");
  });
});

describe("DiagnosticFmt — colour mode", () => {
  const src = "let x = 1;\nlet y = foo + 1;\n";
  const d: Diagnostic = {
    severity: "error",
    phase: "runtime",
    code: ErrorCode.UndefinedVariable,
    message: "undefined variable 'foo'",
    span: mkSpan(pos(19, 2, 9), pos(22, 2, 12)),
  };

  it("emits no ANSI escapes when colour is off (the default)", () => {
    const plain = formatDiagnostic(d, src);
    expect(plain).not.toContain(ESC);
    expect(formatDiagnostic(d, src, { color: false })).toBe(plain);
  });

  it("emits ANSI escapes when colour is on, without changing text structure", () => {
    const plain = formatDiagnostic(d, src);
    const colored = formatDiagnostic(d, src, { color: true });

    expect(colored).toContain(ESC + "[1;31m"); // bold red for `error`
    expect(colored).toContain(ESC + "[1;34m"); // bold blue for gutter/locator
    expect(colored).toContain(ESC + "[0m"); // reset

    // Stripping the ANSI sequences must recover the exact colourless layout.
    const stripped = colored
      .split(ESC + "[1;31m")
      .join("")
      .split(ESC + "[1;33m")
      .join("")
      .split(ESC + "[1;34m")
      .join("")
      .split(ESC + "[0m")
      .join("");
    expect(stripped).toBe(plain);
  });

  it("colours a `warning` header in yellow", () => {
    const warn: Diagnostic = { ...d, severity: "warning" };
    const colored = formatDiagnostic(warn, src, { color: true });
    expect(colored).toContain(ESC + "[1;33m"); // bold yellow for `warning`
  });
});
