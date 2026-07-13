/**
 * CONTRACT — Diagnostic and error model shared across every pipeline stage.
 *
 * READ-ONLY. Declares the *shapes* and *vocabulary* of errors. The CONCRETE
 * error classes and the diagnostic renderer that implement these interfaces are
 * owned by the `scaffold` task in `src/core/` and imported by every component:
 *
 *     import { LexicalError, SyntaxErr, RuntimeErr } from "../core/errors";
 *
 * This split keeps `contracts/` free of behavior while still fixing the exact
 * fields, codes, and rendering contract every stage must honor.
 *
 * Amendments are additive only (new ErrorCode members may be appended).
 */

import { Span } from "./tokens";

/** The phase of the pipeline that produced an error. */
export type ErrorPhase = "lexical" | "syntax" | "runtime";

export type Severity = "error" | "warning";

/**
 * Stable, machine-checkable error codes. Grouped by phase. Consumers (tests,
 * tooling, editor integrations) key off these rather than message text, so
 * messages may be reworded without breaking anyone.
 */
export enum ErrorCode {
  // --- lexical ---
  UnexpectedCharacter = "E1001",
  UnterminatedString = "E1002",
  InvalidEscape = "E1003",
  InvalidNumber = "E1004",
  UnterminatedComment = "E1005",

  // --- syntax ---
  UnexpectedToken = "E2001",
  ExpectedToken = "E2002",
  ExpectedExpression = "E2003",
  InvalidAssignmentTarget = "E2004",
  DuplicateParameter = "E2005",

  // --- runtime ---
  UndefinedVariable = "E3001",
  TypeMismatch = "E3002",
  NotCallable = "E3003",
  WrongArgumentCount = "E3004",
  IndexOutOfRange = "E3005",
  InvalidIndexTarget = "E3006",
  InvalidIndexType = "E3007",
  PropertyNotFound = "E3008",
  DivisionByZero = "E3009",
  InvalidOperand = "E3010",
  AssertionFailed = "E3011",
  StackOverflow = "E3012",
  UserError = "E3013",
}

/** A single frame in a runtime call stack, innermost last. */
export interface StackFrame {
  /** Name of the function, or "<anonymous>" / "<script>". */
  readonly functionName: string;
  /** Call site span (where the call was made). */
  readonly span: Span;
}

/**
 * A structured, source-anchored diagnostic. This is the tool-consumable form
 * every error can be reduced to (for JSON output, editor squiggles, etc.).
 */
export interface Diagnostic {
  readonly severity: Severity;
  readonly phase: ErrorPhase;
  readonly code: ErrorCode;
  readonly message: string;
  readonly span: Span;
  /** Present only for runtime errors; innermost frame last. */
  readonly stack?: readonly StackFrame[];
}

/**
 * The structural contract every Klein error object satisfies. The concrete
 * classes in `src/core/errors.ts` (owned by scaffold) `implements` this and
 * also extend the native `Error` so they interoperate with `throw`/stack traces.
 */
export interface KleinError {
  readonly name: string;
  readonly phase: ErrorPhase;
  readonly code: ErrorCode;
  readonly message: string;
  readonly span: Span;
  /** Reduce to the tool-consumable diagnostic form. */
  toDiagnostic(): Diagnostic;
}

/**
 * Renders a diagnostic into a human-readable, multi-line string with a source
 * snippet and a caret underline, e.g.:
 *
 *   error[E3001]: undefined variable 'foo'
 *    --> script.kl:3:9
 *     |
 *   3 |   let y = foo + 1;
 *     |           ^^^ not defined in this scope
 *
 * Implemented by scaffold in `src/core/diagnostic.ts`.
 */
export interface DiagnosticFormatter {
  /**
   * @param diagnostic the diagnostic to render
   * @param source the full source text the diagnostic's span indexes into
   * @param options.color whether to emit ANSI color codes
   */
  format(
    diagnostic: Diagnostic,
    source: string,
    options?: { readonly color?: boolean },
  ): string;
}
