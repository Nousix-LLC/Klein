/**
 * Tests for the `interpret()` facade and the package's public API barrel
 * (`src/index.ts`).
 *
 * The facade is driven end-to-end through the **real** lexer → parser →
 * interpreter pipeline (never a mocked stage), exactly as a library consumer
 * would call it. Every assertion keys off the discriminated `InterpretOutcome`
 * (`ok` / `value` / `diagnostics`) and structured `ErrorCode`s + `ValueKind`s —
 * never off human-readable diagnostic message text (per the project quality bar).
 *
 * The imports below deliberately come from the public entry `../../src/index`
 * (not from the internal `@contracts` / `@core` modules), so this suite also
 * verifies the barrel re-exports the intended public surface.
 */

import { describe, expect, it, vi } from "vitest";

import {
  ErrorCode,
  interpret,
  LexicalError,
  RuntimeErr,
  SyntaxErr,
  ValueKind,
  type InterpretOutcome,
} from "../../src/index";

// ─────────────────────────────────────────────────────────────────────────────
// Success (ok) outcomes
// ─────────────────────────────────────────────────────────────────────────────

describe("interpret — ok outcomes", () => {
  it("returns ok with the final top-level expression's value and no diagnostics", () => {
    const outcome = interpret("let x = 1 + 2; x;");

    expect(outcome.ok).toBe(true);
    expect(outcome.diagnostics).toEqual([]);
    // Value is inspected structurally via the discriminated union, not stringified.
    const value = outcome.value;
    expect(value?.kind).toBe(ValueKind.Number);
    if (value?.kind === ValueKind.Number) {
      expect(value.value).toBe(3);
    }
  });

  it("returns ok with a null value when the program has no final expression statement", () => {
    const outcome = interpret("let x = 42;");

    expect(outcome.ok).toBe(true);
    expect(outcome.diagnostics).toEqual([]);
    expect(outcome.value?.kind).toBe(ValueKind.Null);
  });

  it("returns ok for the empty program", () => {
    const outcome = interpret("");

    expect(outcome.ok).toBe(true);
    expect(outcome.diagnostics).toEqual([]);
    expect(outcome.value?.kind).toBe(ValueKind.Null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lexical-error outcomes
// ─────────────────────────────────────────────────────────────────────────────

describe("interpret — lexical errors", () => {
  it("captures a lexical error as a diagnostic and does not run", () => {
    const outcome = interpret("@");

    expect(outcome.ok).toBe(false);
    expect(outcome.value).toBeNull();
    expect(outcome.diagnostics).toHaveLength(1);
    const diagnostic = outcome.diagnostics[0];
    expect(diagnostic?.phase).toBe("lexical");
    expect(diagnostic?.code).toBe(ErrorCode.UnexpectedCharacter);
  });

  it("captures an unterminated-string lexical error", () => {
    const outcome = interpret('let s = "oops');

    expect(outcome.ok).toBe(false);
    expect(outcome.value).toBeNull();
    expect(outcome.diagnostics.some((d) => d.phase === "lexical")).toBe(true);
    expect(
      outcome.diagnostics.some((d) => d.code === ErrorCode.UnterminatedString),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parse-error outcomes
// ─────────────────────────────────────────────────────────────────────────────

describe("interpret — parse errors", () => {
  it("captures a missing-semicolon syntax error", () => {
    const outcome = interpret("let x = 5");

    expect(outcome.ok).toBe(false);
    expect(outcome.value).toBeNull();
    expect(outcome.diagnostics.length).toBeGreaterThan(0);
    // A lex-clean but syntactically invalid program yields only syntax diagnostics.
    expect(outcome.diagnostics.every((d) => d.phase === "syntax")).toBe(true);
    expect(
      outcome.diagnostics.some((d) => d.code === ErrorCode.ExpectedToken),
    ).toBe(true);
  });

  it("captures a missing-expression syntax error", () => {
    const outcome = interpret("let x = + 1;");

    expect(outcome.ok).toBe(false);
    expect(outcome.value).toBeNull();
    expect(
      outcome.diagnostics.some((d) => d.code === ErrorCode.ExpectedExpression),
    ).toBe(true);
  });

  it("does NOT execute the program when the front-end has errors (short-circuit)", () => {
    const write = vi.fn<(text: string) => void>();
    // `println(1)` WOULD write if the program ran; the trailing `let =` is a hard
    // parse error, so a correct facade short-circuits before running.
    const outcome = interpret("println(1); let =", { write });

    expect(outcome.ok).toBe(false);
    expect(outcome.value).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Front-end diagnostic ordering (lexical + syntax merged in source order)
// ─────────────────────────────────────────────────────────────────────────────

describe("interpret — diagnostic ordering", () => {
  it("merges lexical and syntax diagnostics in source order", () => {
    // `@` is a lexical error at offset 0; the trailing `let x = 5` (no semicolon)
    // is a syntax error later in the source.
    const outcome = interpret("@ let x = 5");

    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics.length).toBeGreaterThanOrEqual(2);
    // Diagnostics are ordered by span start offset (non-decreasing).
    const offsets = outcome.diagnostics.map((d) => d.span.start.offset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    // The lexical error (offset 0) sorts before the later syntax error.
    expect(outcome.diagnostics[0]?.phase).toBe("lexical");
    expect(outcome.diagnostics.some((d) => d.phase === "syntax")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime-error outcomes
// ─────────────────────────────────────────────────────────────────────────────

describe("interpret — runtime errors", () => {
  it("captures an undefined-variable runtime error with a call stack", () => {
    const outcome = interpret("missing;");

    expect(outcome.ok).toBe(false);
    expect(outcome.value).toBeNull();
    expect(outcome.diagnostics).toHaveLength(1);
    const diagnostic = outcome.diagnostics[0];
    expect(diagnostic?.phase).toBe("runtime");
    expect(diagnostic?.code).toBe(ErrorCode.UndefinedVariable);
    // Runtime diagnostics carry the Klein call stack (innermost frame last).
    expect(diagnostic?.stack).toBeDefined();
    expect(diagnostic?.stack?.length).toBeGreaterThanOrEqual(1);
  });

  it("captures a division-by-zero runtime error", () => {
    const outcome = interpret("1 / 0;");

    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics[0]?.code).toBe(ErrorCode.DivisionByZero);
  });

  it("does not swallow non-Klein host errors thrown by a custom builtin", () => {
    // A builtin whose impl throws a plain JS Error is a host fault, not a
    // Klein-level fault; the facade must let it propagate rather than report it.
    const exploding = {
      kind: ValueKind.Builtin as const,
      name: "boom",
      arity: { min: 0, max: null },
      impl: () => {
        throw new Error("host bug");
      },
    };

    expect(() => interpret("boom();", { builtins: [exploding] })).toThrow(
      "host bug",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Option wiring: write sink, builtins, sourceName, maxCallDepth
// ─────────────────────────────────────────────────────────────────────────────

describe("interpret — options", () => {
  it("captures print/println output through an injected write sink deterministically", () => {
    const chunks: string[] = [];
    const write = (text: string): void => {
      chunks.push(text);
    };

    const outcome = interpret('print("a", "b"); println("c");', { write });

    expect(outcome.ok).toBe(true);
    // `print` space-joins with no newline; `println` appends one.
    expect(chunks.join("")).toBe("a bc\n");
  });

  it("defaults the output sink to process.stdout when no write is supplied", () => {
    // The ONLY path that touches the real stdout is the default sink; drive it
    // through a controlled spy (restored immediately) rather than emitting.
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      const outcome = interpret('print("hi");');
      expect(outcome.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith("hi");
    } finally {
      spy.mockRestore();
    }
  });

  it("honors a custom builtins roster (empty roster ⇒ print is undefined)", () => {
    const outcome = interpret('print("x");', { builtins: [] });

    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics[0]?.code).toBe(ErrorCode.UndefinedVariable);
  });

  it("defaults the diagnostic source name to <script> and honors an override", () => {
    expect(interpret("@").diagnostics[0]?.span.source).toBe("<script>");
    expect(
      interpret("@", { sourceName: "prog.kl" }).diagnostics[0]?.span.source,
    ).toBe("prog.kl");
  });

  it("wires maxCallDepth so unbounded recursion becomes a StackOverflow", () => {
    const outcome = interpret("fn f() { return f(); } f();", {
      maxCallDepth: 8,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.diagnostics[0]?.code).toBe(ErrorCode.StackOverflow);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API barrel
// ─────────────────────────────────────────────────────────────────────────────

describe("public API surface", () => {
  it("re-exports the concrete Klein error classes", () => {
    // These come from `../../src/index` — proving the barrel re-exports them.
    expect(typeof LexicalError).toBe("function");
    expect(typeof SyntaxErr).toBe("function");
    expect(typeof RuntimeErr).toBe("function");
  });

  it("re-exports the ErrorCode and ValueKind enums as runtime values", () => {
    expect(ErrorCode.UndefinedVariable).toBe("E3001");
    expect(ValueKind.Number).toBe("number");
  });

  it("exposes a well-typed InterpretOutcome", () => {
    const outcome: InterpretOutcome = interpret("1;");
    expect(outcome.ok).toBe(true);
  });
});
