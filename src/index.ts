/**
 * Klein — public library entry point.
 *
 * This module is the package's front door. It exposes exactly two things and
 * nothing more:
 *
 *   1. {@link interpret} — the single facade that drives the completed
 *      lexer → parser → interpreter pipeline end-to-end and reduces every
 *      Klein-level fault (lexical, syntax, runtime) to a structured
 *      {@link InterpretOutcome}. It never throws to its caller for a
 *      Klein-level fault; those are captured as diagnostics.
 *   2. The deliberate public API surface — the contract *types* a consumer needs
 *      to work with an outcome (the diagnostic vocabulary + the value model) and
 *      the concrete error *classes* (`LexicalError` / `SyntaxErr` / `RuntimeErr`)
 *      so callers can `instanceof`-narrow a thrown Klein error if they choose to
 *      work at a lower level.
 *
 * Everything else (the `Lexer`/`Parser`/`Interpreter` machinery, the token/AST
 * vocabulary, the value constructors) is an internal implementation detail the
 * facade hides. The CLI and REPL (sibling tasks) build on `interpret()`; they do
 * not re-derive the pipeline.
 *
 * This file carries real wiring logic (it is NOT a pure re-export barrel), so it
 * is intentionally NOT excluded from coverage.
 */

import {
  type Diagnostic,
  type InterpretFacadeOptions,
  type InterpretOutcome,
  type InterpreterOptions,
  type KleinError,
} from "@contracts";
import { RuntimeErr } from "@core";

import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./runtime";
import { defaultBuiltins } from "./stdlib";

/** The logical source name used in diagnostics when the caller supplies none. */
const DEFAULT_SOURCE_NAME = "<script>";

/**
 * The default output sink for `print` / `println`: the real process stdout.
 * Wrapped in a `void`-returning arrow so the facade's `write` contract
 * (`(text: string) => void`) is honored exactly — `process.stdout.write` itself
 * returns a `boolean` we deliberately discard. Tests inject their own sink and
 * never touch the real stdout.
 */
const defaultWrite = (text: string): void => {
  process.stdout.write(text);
};

/**
 * Run Klein `source` end-to-end and return a single discriminated
 * {@link InterpretOutcome}.
 *
 * Pipeline, in order:
 *   1. **Lex** — the error-tolerant lexer collects lexical diagnostics and always
 *      returns a token stream terminated by EOF.
 *   2. **Parse** — the error-tolerant parser recovers and collects syntax
 *      diagnostics, always returning a (possibly partial) program.
 *   3. **Short-circuit** — lexical + syntax errors are merged into `Diagnostic[]`
 *      in source order; if *any* exist, the facade returns `{ ok: false,
 *      value: null }` WITHOUT running the program (a program that failed to lex or
 *      parse is not meaningfully runnable).
 *   4. **Run** — otherwise the interpreter evaluates the program. The first
 *      runtime fault surfaces as a thrown {@link RuntimeErr}, which is caught and
 *      converted to its diagnostic form. Any other throwable is a genuine host
 *      (non-Klein) fault and is re-thrown — the facade only owns Klein-level
 *      faults.
 *
 * @param source the Klein program text
 * @param options facade options (see {@link InterpretFacadeOptions}); all optional
 * @returns the outcome: `ok`, the program's result `value` (or `null`), and every
 *   collected diagnostic in source order
 */
export function interpret(
  source: string,
  options: InterpretFacadeOptions = {},
): InterpretOutcome {
  const sourceName = options.sourceName ?? DEFAULT_SOURCE_NAME;
  const write = options.write ?? defaultWrite;

  // 1 + 2: lex, then parse. Both stages are error-tolerant and always return.
  const { tokens, errors: lexErrors } = new Lexer(
    source,
    sourceName,
  ).tokenize();
  const { program, errors: parseErrors } = new Parser(
    tokens,
    sourceName,
  ).parse();

  // 3: merge front-end diagnostics in source order and short-circuit if any.
  const frontEndDiagnostics = mergeInSourceOrder(lexErrors, parseErrors);
  if (frontEndDiagnostics.length > 0) {
    return { ok: false, value: null, diagnostics: frontEndDiagnostics };
  }

  // 4: a lex/parse-clean program is runnable. Build the interpreter with the
  // resolved sink + builtins and evaluate; convert a RuntimeErr to a diagnostic.
  const interpreterOptions: InterpreterOptions = {
    write,
    builtins: options.builtins ?? defaultBuiltins(),
    // `maxCallDepth` is included only when provided: `exactOptionalPropertyTypes`
    // forbids handing `maxCallDepth: undefined` to the optional contract field,
    // and an omitted value must let the interpreter apply its own default.
    ...(options.maxCallDepth === undefined
      ? {}
      : { maxCallDepth: options.maxCallDepth }),
  };

  try {
    const value = new Interpreter(interpreterOptions).run(program);
    return { ok: true, value, diagnostics: [] };
  } catch (error) {
    if (error instanceof RuntimeErr) {
      return { ok: false, value: null, diagnostics: [error.toDiagnostic()] };
    }
    // Not a Klein-level fault — a bug in a host builtin or the runtime itself.
    // Surfacing it is correct; swallowing it would hide real defects.
    throw error;
  }
}

/**
 * Merge the lexer's and parser's collected errors into a single `Diagnostic[]`
 * ordered by source position (by span start offset, then end offset), so a
 * caller sees every front-end error in the order it appears in the source.
 */
function mergeInSourceOrder(
  lexErrors: readonly KleinError[],
  parseErrors: readonly KleinError[],
): Diagnostic[] {
  return [...lexErrors, ...parseErrors]
    .sort((a, b) => {
      const startDelta = a.span.start.offset - b.span.start.offset;
      return startDelta !== 0
        ? startDelta
        : a.span.end.offset - b.span.end.offset;
    })
    .map((error) => error.toDiagnostic());
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API surface (deliberate — the package's library entry, nothing more)
// ─────────────────────────────────────────────────────────────────────────────

// Concrete error classes (real `Error` subclasses) so callers can `instanceof`
// a Klein error when working below the facade. From `@core` (the behavior).
export { LexicalError, SyntaxErr, RuntimeErr } from "@core";

// Enum vocabularies are runtime values — re-exported as values, not types.
export { ErrorCode, ValueKind } from "@contracts";

// The contract *types* a consumer needs to work with an `InterpretOutcome`:
// the facade result types, the diagnostic vocabulary, and the value model
// (including the builtin-authoring types referenced by `InterpretFacadeOptions`).
// Re-exported as types (erasable under `isolatedModules`).
export type {
  // Facade result + options
  InterpretOutcome,
  InterpretFacadeOptions,
  // Diagnostic vocabulary
  Diagnostic,
  KleinError,
  ErrorPhase,
  Severity,
  StackFrame,
  // Value model
  Value,
  NullValue,
  BooleanValue,
  NumberValue,
  StringValue,
  ArrayValue,
  ObjectValue,
  FunctionValue,
  BuiltinValue,
  // Builtin calling convention (for callers supplying custom `builtins`)
  Arity,
  BuiltinImpl,
  BuiltinContext,
} from "@contracts";
