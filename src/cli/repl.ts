/**
 * The Klein interactive REPL — `startRepl(io)`.
 *
 * A read-eval-print loop with four product-visible behaviors:
 *
 *   1. **Persistent global state across entries.** `let x = 1;` on one line and
 *      `x + 1;` on the next both see the same global scope, so a session builds up
 *      state exactly as a user expects.
 *   2. **Multiline continuation.** An entry whose delimiters are unbalanced (open
 *      `(`/`[`/`{`, or an open block comment) is not yet runnable; the loop shows
 *      a continuation prompt and keeps reading until the buffer is balanced (or the
 *      user cancels with a blank continuation line). Klein strings are single-line,
 *      so an unterminated string is a reported error rather than a continuation.
 *   3. **Non-fatal, readable errors.** A lexical, syntax, or runtime fault in one
 *      entry renders a source-anchored diagnostic and the session keeps going —
 *      one bad entry never tears the REPL down.
 *   4. **Meta-commands.** `.exit` quits cleanly; `.help` prints usage.
 *
 * ── Persistent-state mechanism (the design decision this task had to make) ──
 * Two shapes were offered by the brief: (a) hold one long-lived `Interpreter` and
 * feed each entry's parsed `Program` to `run()` on its shared globals, or (b)
 * thread a persistent environment through repeated `interpret()` facade calls.
 * Shape (b) is not actually available: the `interpret()` facade constructs a
 * FRESH `Interpreter` per call (see `src/index.ts`), so it cannot carry state
 * between entries. Shape (a) is therefore the correct — and cleanest — mechanism:
 * `Interpreter.run()` executes a program's top-level statements directly in
 * `this.globals` (see `src/runtime/interpreter.ts`), so a single long-lived
 * interpreter accumulates every `let`/`fn`/assignment across entries for free.
 *
 * Because we hold the interpreter ourselves, we also drive the front end (lex →
 * parse) ourselves rather than through `interpret()`. This is deliberate reuse,
 * not reimplementation: we call the real `Lexer`, `Parser`, `@core`'s
 * `formatDiagnostic`, and the runtime's `stringify` — the REPL never re-derives
 * tokenizing, rendering, or value formatting. The only facade logic mirrored here
 * is the trivial "merge front-end diagnostics in source order and short-circuit
 * before running" step, which is inherent to driving a stateful pipeline.
 *
 * ── Result echoing ──
 * A non-`null` result value is echoed via the runtime `stringify`. A `null`
 * result is suppressed (per the brief): declarations, loops, assignments-to-null,
 * and output-only calls like `println(...)` all evaluate to `null`, and echoing
 * `null` after each of them would just be noise. The documented cost is that
 * typing a bare `null` echoes nothing — an acceptable trade for a clean session.
 *
 * ── Testability ──
 * Every byte of output (prompts, values, banners) goes through `io.stdout`; every
 * rendered diagnostic goes through `io.stderr`; every input line comes from
 * `io.nextLine()`. Nothing here touches the real `process` — binding the real
 * stdin/stdout is `bin/klein.mjs`'s job (the `synthesis` task). A fully scripted
 * session is therefore deterministically testable.
 */

import {
  ErrorCode,
  TokenType,
  ValueKind,
  type Diagnostic,
  type KleinError,
} from "@contracts";
import { formatDiagnostic, RuntimeErr } from "@core";

import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { Interpreter, stringify } from "../runtime";
import { defaultBuiltins } from "../stdlib";

// ─────────────────────────────────────────────────────────────────────────────
// Injected I/O — the seam that makes a session fully scriptable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The I/O capabilities `startRepl` needs, all injected so a session is testable
 * without the real `process`. `bin/klein.mjs` (the `synthesis` task) provides the
 * production implementation backed by `readline` + `process.stdout`/`stderr`.
 */
export interface ReplIo {
  /** Write to standard output (prompts, banners, echoed values). No implicit newline. */
  readonly stdout: (text: string) => void;
  /** Write to standard error (rendered diagnostics). No implicit newline. */
  readonly stderr: (text: string) => void;
  /**
   * Read the next line of input WITHOUT its trailing newline. Resolves to `null`
   * at end-of-input (EOF / Ctrl-D / closed stream), which ends the session
   * cleanly — exactly as `.exit` does.
   */
  readonly nextLine: () => Promise<string | null>;
  /** Emit ANSI colour in rendered diagnostics. Defaults to `false`. */
  readonly color?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Logical source name stamped on REPL diagnostics' spans. */
const SOURCE_NAME = "<repl>";

/** Shown when the REPL is ready for a fresh entry. */
const PRIMARY_PROMPT = "klein> ";

/** Shown while an unbalanced multiline entry is still being read. */
const CONTINUATION_PROMPT = "...     ";

/** One-time greeting written when the loop starts. */
const BANNER = "Klein REPL — type .help for commands, .exit to quit.\n";

/** Bracket-opening token kinds; each increases nesting depth by one. */
const OPENERS: ReadonlySet<TokenType> = new Set([
  TokenType.LParen,
  TokenType.LBrace,
  TokenType.LBracket,
]);

/** Bracket-closing token kinds; each decreases nesting depth by one. */
const CLOSERS: ReadonlySet<TokenType> = new Set([
  TokenType.RParen,
  TokenType.RBrace,
  TokenType.RBracket,
]);

/** Usage text for the `.help` meta-command. */
const HELP_TEXT =
  "Commands:\n" +
  "  .help   show this message\n" +
  "  .exit   leave the REPL (Ctrl-D also works)\n" +
  "\n" +
  "Enter Klein expressions or statements. State persists across entries, so a\n" +
  "binding defined on one line is visible on later lines. An entry with an open\n" +
  "'(', '[', '{', or block comment continues on the next line; submit a blank\n" +
  "line at the '...' prompt to cancel a multiline entry.\n";

// ─────────────────────────────────────────────────────────────────────────────
// The loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start an interactive REPL over the injected {@link ReplIo}. Resolves when the
 * session ends — via `.exit` or end-of-input. Never rejects for a Klein-level
 * fault (those are rendered and the loop continues); a genuine host fault (a bug
 * in a builtin or the runtime itself) is allowed to propagate, since swallowing
 * it would hide a real defect.
 *
 * @param io the injected stdout/stderr sinks and line source
 */
export async function startRepl(io: ReplIo): Promise<void> {
  // One long-lived interpreter ⇒ globals (bindings, functions) persist across
  // every entry. Builtins are installed once; `print`/`println` write to stdout.
  const interpreter = new Interpreter({
    write: (text: string): void => io.stdout(text),
    builtins: defaultBuiltins(),
  });

  io.stdout(BANNER);

  // Accumulates the lines of the current (possibly multiline) entry. Empty
  // between entries; non-empty means we are mid-continuation.
  let buffer = "";

  for (;;) {
    io.stdout(buffer === "" ? PRIMARY_PROMPT : CONTINUATION_PROMPT);
    const line = await io.nextLine();

    if (line === null) {
      // End-of-input: finish the line visually and end the session. Any partial
      // multiline buffer is intentionally discarded.
      io.stdout("\n");
      return;
    }

    if (buffer === "") {
      // Meta-commands are recognized only at the START of an entry, so a literal
      // ".exit" inside a multiline string is never mistaken for the command.
      const command = line.trim();
      if (command === ".exit") {
        return;
      }
      if (command === ".help") {
        io.stdout(HELP_TEXT);
        continue;
      }
    } else if (line.trim() === "") {
      // A blank line at the continuation prompt cancels the in-progress entry —
      // the escape hatch for input that will never balance.
      buffer = "";
      continue;
    }

    // Append this line to the entry (newline-separated so spans stay accurate).
    buffer = buffer === "" ? line : `${buffer}\n${line}`;

    // Not yet runnable? Keep reading. Otherwise evaluate and reset for the next.
    if (!isComplete(buffer)) {
      continue;
    }
    evaluateEntry(interpreter, io, buffer);
    buffer = "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Completeness (multiline continuation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide whether `source` is a complete entry (ready to run) or should keep
 * reading. Reuses the real {@link Lexer} so string/comment scanning is never
 * re-implemented, and counts bracket nesting over the token stream (a bracket
 * inside a string or comment never becomes its own token, so it cannot skew the
 * balance).
 *
 * Two lexical facts drive the string/comment cases, and they differ because Klein
 * block comments span newlines while Klein string literals do NOT (the lexer ends
 * a string at a newline — see `src/lexer/lexer.ts#scanString`):
 *   - An **unterminated block comment** is genuinely unfinished → keep reading.
 *   - An **unterminated string** cannot be finished on a later line (the newline
 *     already closed the entry lexically), so it is a real error, not a
 *     continuation → report the entry COMPLETE and let the diagnostic surface.
 *
 * Otherwise: INCOMPLETE when openers `(`/`[`/`{` outnumber their closers; COMPLETE
 * when balanced. A *stray closer* (depth would go negative) is a syntax error, not
 * an unfinished entry, so we report COMPLETE and let the parser surface it.
 */
function isComplete(source: string): boolean {
  const { tokens, errors } = new Lexer(source, SOURCE_NAME).tokenize();

  for (const error of errors) {
    if (error.code === ErrorCode.UnterminatedComment) {
      // Block comments span lines — keep reading until the closing `*/`.
      return false;
    }
    if (error.code === ErrorCode.UnterminatedString) {
      // Strings are single-line in Klein; this can only be a real error. Run it
      // so the lexical diagnostic is shown rather than waiting for a close that
      // can never come.
      return true;
    }
  }

  let depth = 0;
  for (const token of tokens) {
    if (OPENERS.has(token.type)) {
      depth += 1;
    } else if (CLOSERS.has(token.type)) {
      depth -= 1;
      if (depth < 0) {
        // Unmatched closer — a real error, not a continuation. Let it run.
        return true;
      }
    }
  }

  return depth === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation (the eval-print half)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run one complete entry against the persistent `interpreter`, rendering any
 * diagnostic and echoing a non-`null` result. Never throws for a Klein-level
 * fault; a non-Klein host throwable propagates (a real defect should not be
 * hidden behind a REPL prompt).
 */
function evaluateEntry(
  interpreter: Interpreter,
  io: ReplIo,
  source: string,
): void {
  // Drive the real front end. Both stages are error-tolerant and always return.
  const { tokens, errors: lexErrors } = new Lexer(
    source,
    SOURCE_NAME,
  ).tokenize();
  const { program, errors: parseErrors } = new Parser(
    tokens,
    SOURCE_NAME,
  ).parse();

  // Merge front-end diagnostics in source order; a program that failed to lex or
  // parse is not meaningfully runnable, so short-circuit before running it.
  const frontEnd = mergeInSourceOrder(lexErrors, parseErrors);
  if (frontEnd.length > 0) {
    renderDiagnostics(io, source, frontEnd);
    return;
  }

  try {
    const value = interpreter.run(program);
    // Suppress `null` results (declarations, loops, `println(...)`, …) — see the
    // module header. Only a meaningful value is echoed, via the canonical stringifier.
    if (value.kind !== ValueKind.Null) {
      io.stdout(`${stringify(value)}\n`);
    }
  } catch (error) {
    if (error instanceof RuntimeErr) {
      renderDiagnostics(io, source, [error.toDiagnostic()]);
      return;
    }
    // Not a Klein-level fault — surface it rather than swallow a real bug.
    throw error;
  }
}

/**
 * Merge the lexer's and parser's collected errors into one `Diagnostic[]` ordered
 * by source position (span start offset, then end offset), so the user sees every
 * front-end error in the order it appears. Mirrors the `interpret()` facade's
 * ordering so REPL and file output are consistent.
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

/** Render each diagnostic through the shared `@core` renderer to `io.stderr`. */
function renderDiagnostics(
  io: ReplIo,
  source: string,
  diagnostics: readonly Diagnostic[],
): void {
  const color = io.color ?? false;
  for (const diagnostic of diagnostics) {
    io.stderr(`${formatDiagnostic(diagnostic, source, { color })}\n`);
  }
}
