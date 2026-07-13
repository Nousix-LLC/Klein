/**
 * Concrete Klein error classes — the source-anchored, structured errors every
 * pipeline stage throws.
 *
 * Each class both `extends Error` (so instances interoperate with `throw`,
 * `try/catch`, and JS stack traces) AND `implements` the read-only
 * `contracts/errors.ts#KleinError` structural contract (so every instance carries
 * a phase, a stable machine-checkable `code`, a source `span`, and reduces to a
 * tool-consumable {@link Diagnostic}). The contract types are imported literally
 * from `@contracts` — never re-declared here.
 *
 * Span construction is delegated to the `./span` helpers by callers; this module
 * only stores the `Span` it is handed, so it never re-derives range geometry.
 *
 * Naming note (deliberate, documented): the Klein runtime call stack on
 * {@link RuntimeErr} is exposed as `callStack`, NOT `stack`. The native `Error`
 * already owns `stack` (the JS stack-trace *string*), and TypeScript will not let
 * a subclass re-type an inherited property to `readonly StackFrame[]`. The two are
 * intentionally distinct (see the brief: "the Klein call stack, distinct from the
 * JS `Error.stack`"); `toDiagnostic()` maps `callStack` onto the diagnostic's
 * contract-typed `stack` field.
 */

import {
  type Diagnostic,
  type ErrorCode,
  type ErrorPhase,
  type KleinError,
  type Severity,
  type Span,
  type StackFrame,
} from "@contracts";

/** Klein errors are always hard errors (never warnings). */
const SEVERITY: Severity = "error";

/**
 * Shared abstract base for every concrete Klein error. Holds the fields common to
 * all phases (`code`, `span`, and the inherited `Error.message`) and the default
 * {@link toDiagnostic} reduction; each concrete subclass fixes its own `phase` and
 * display `name`.
 */
export abstract class KleinErrorBase extends Error implements KleinError {
  /** The pipeline phase that produced this error — fixed by each subclass. */
  abstract readonly phase: ErrorPhase;

  /** Stable, machine-checkable error code (see `contracts/errors.ts#ErrorCode`). */
  readonly code: ErrorCode;

  /** The source range this error is anchored to (always present). */
  readonly span: Span;

  protected constructor(code: ErrorCode, message: string, span: Span) {
    super(message);
    this.code = code;
    this.span = span;
    // Restore the prototype chain so `instanceof` holds even if this code is ever
    // downleveled below the ES2022 target (the canonical `extends Error` idiom).
    // Harmless on native ES2022 classes, where the chain is already correct.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Reduce this error to the tool-consumable {@link Diagnostic} form (JSON output,
   * editor squiggles, the diagnostic renderer). Subclasses that carry extra
   * structure (e.g. {@link RuntimeErr}'s call stack) extend this.
   */
  toDiagnostic(): Diagnostic {
    return {
      severity: SEVERITY,
      phase: this.phase,
      code: this.code,
      message: this.message,
      span: this.span,
    };
  }
}

/** A lexical-phase error produced by the tokenizer. Fixes `phase = "lexical"`. */
export class LexicalError extends KleinErrorBase {
  readonly phase: ErrorPhase = "lexical";

  constructor(code: ErrorCode, message: string, span: Span) {
    super(code, message, span);
    this.name = "LexicalError";
  }
}

/** A syntax-phase error produced by the parser. Fixes `phase = "syntax"`. */
export class SyntaxErr extends KleinErrorBase {
  readonly phase: ErrorPhase = "syntax";

  constructor(code: ErrorCode, message: string, span: Span) {
    super(code, message, span);
    this.name = "SyntaxErr";
  }
}

/**
 * A runtime-phase error produced by the evaluator. Fixes `phase = "runtime"` and
 * may additionally carry the Klein call stack captured at the throw site.
 *
 * The call stack is exposed as `callStack` (innermost frame last); see the module
 * header for why it is not named `stack`. When present it is threaded through
 * {@link toDiagnostic} onto the diagnostic's `stack` field.
 */
export class RuntimeErr extends KleinErrorBase {
  readonly phase: ErrorPhase = "runtime";

  /** The Klein call stack at the throw site (innermost frame last), if captured. */
  readonly callStack?: readonly StackFrame[];

  constructor(
    code: ErrorCode,
    message: string,
    span: Span,
    callStack?: readonly StackFrame[],
  ) {
    super(code, message, span);
    this.name = "RuntimeErr";
    // Only set when provided: `exactOptionalPropertyTypes` forbids assigning
    // `undefined` to an optional property, and an absent call stack must stay
    // absent from the emitted diagnostic.
    if (callStack !== undefined) {
      this.callStack = callStack;
    }
  }

  override toDiagnostic(): Diagnostic {
    const diagnostic = super.toDiagnostic();
    return this.callStack === undefined
      ? diagnostic
      : { ...diagnostic, stack: this.callStack };
  }
}
