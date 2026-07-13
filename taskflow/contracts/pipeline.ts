/**
 * CONTRACT — Stage interfaces and the top-level `interpret` facade result types.
 *
 * READ-ONLY. Fixes the boundary shapes between stages so they compose without
 * drift: Lexer → Parser → Interpreter, and the public `interpret()` facade the
 * `cli` task exposes.
 *
 * Import, do not re-declare:
 *     import { Lexer, LexResult, InterpretOutcome } from "../../contracts/pipeline";
 */

import { Token } from "./tokens";
import { Program } from "./ast";
import { KleinError, Diagnostic } from "./errors";
import { Value, BuiltinValue } from "./values";

/**
 * Result of lexing. The lexer is error-tolerant: it collects lexical errors and
 * continues, always returning a token stream terminated by a single EOF token.
 */
export interface LexResult {
  readonly tokens: readonly Token[];
  readonly errors: readonly KleinError[];
}

/**
 * The Lexer is constructed with `(source, sourceName)` and produces all tokens
 * in one call. Owned + implemented by the `lexer` task.
 */
export interface Lexer {
  tokenize(): LexResult;
}

/**
 * Result of parsing. The parser is error-tolerant: on an error it records a
 * diagnostic and recovers (synchronizes to the next statement boundary) so it
 * can report multiple syntax errors in one pass. `program` is always returned,
 * possibly partial, when `errors` is non-empty.
 */
export interface ParseResult {
  readonly program: Program;
  readonly errors: readonly KleinError[];
}

/** The Parser is constructed with `(tokens, sourceName)`. Owned by the `parser` task. */
export interface Parser {
  parse(): ParseResult;
}

/**
 * The outcome of running source end-to-end through the `interpret()` facade.
 * A single discriminated result — never throws to the caller for *Klein-level*
 * faults (lexical, syntax, or runtime); those are captured as diagnostics.
 */
export interface InterpretOutcome {
  /** True iff there were no errors of any phase. */
  readonly ok: boolean;
  /** Value of the program's final expression statement when ok; otherwise null. */
  readonly value: Value | null;
  /** All collected diagnostics, in source order, across every phase. */
  readonly diagnostics: readonly Diagnostic[];
}

/** Options accepted by the top-level `interpret()` facade (owned by `cli` task). */
export interface InterpretFacadeOptions {
  /** Logical source name used in diagnostics. Defaults to "<script>". */
  readonly sourceName?: string;
  /** Output sink for `print`/`println`. Defaults to process.stdout. */
  readonly write?: (text: string) => void;
  /** Override the installed builtins (defaults to the full stdlib). */
  readonly builtins?: Iterable<BuiltinValue>;
  /** Max user-function call depth before StackOverflow. */
  readonly maxCallDepth?: number;
}
