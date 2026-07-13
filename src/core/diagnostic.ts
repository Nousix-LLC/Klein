/**
 * Diagnostic renderer — the concrete implementation of the `DiagnosticFormatter`
 * contract (`contracts/errors.ts`). It turns a structured, source-anchored
 * `Diagnostic` plus the full source text into the human-readable, rustc-style
 * snippet + caret layout Klein shows users:
 *
 *     error[E3001]: undefined variable 'foo'
 *      --> script.kl:3:9
 *       |
 *     3 |   let y = foo + 1;
 *       |           ^^^
 *
 * Layout algorithm (self-consistent; every pipe aligns at column `gutterW + 1`):
 *   - Header  : `severity[CODE]: message`               (severity-aware).
 *   - Locator : `<pad>--> source:line:col`              (from `span.start`).
 *   - Gutter  : line numbers right-aligned to the widest line number shown,
 *               separated by ` | `; an opening blank gutter line frames the
 *               snippet.
 *   - Snippet : the source line(s) the span covers.
 *   - Caret   : a run of `^` under the span columns (>= 1 caret; clamped to the
 *               line length), one caret line per covered source line.
 *   - Stack   : optional trailing runtime frames when `diagnostic.stack` is set.
 *
 * Design note — the caret carries no trailing label. The `Diagnostic` contract
 * exposes a single `message`, which this renderer places in the header. The
 * contract docstring's illustrative `^^^ not defined in this scope` label would
 * require a second, separate label field that the contract does not provide;
 * rather than confabulate one, the caret is left unlabelled and the message
 * lives in the header. The *structural* layout (header / locator / gutter /
 * snippet / caret) matches the contract exactly.
 *
 * Column math is 1-based and counts UTF-16 code units, matching `Position`
 * (`contracts/tokens.ts`). Spans are half-open `[start, end)`. Out-of-range,
 * empty, and zero-width spans are rendered defensively and never throw.
 */
import {
  type Diagnostic,
  type DiagnosticFormatter,
  type Severity,
  type StackFrame,
} from "@contracts";

/** Options accepted by {@link DiagnosticFmt.format}. Mirrors the contract. */
export interface RenderOptions {
  readonly color?: boolean;
}

// --- ANSI SGR sequences (only emitted when `options.color` is on) ---
const RESET = "\x1b[0m";
const BOLD_RED = "\x1b[1;31m";
const BOLD_YELLOW = "\x1b[1;33m";
const BOLD_BLUE = "\x1b[1;34m";

/** The accent colour for a severity's header tag and caret run. */
function severityColor(severity: Severity): string {
  switch (severity) {
    case "error":
      return BOLD_RED;
    case "warning":
      return BOLD_YELLOW;
  }
}

/** Wrap `text` in an ANSI sequence when colour is enabled, else return it raw. */
function paint(text: string, code: string, enabled: boolean): string {
  return enabled ? `${code}${text}${RESET}` : text;
}

/** Split source into display lines, tolerating both `\n` and `\r\n`. */
function splitLines(source: string): readonly string[] {
  return source
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

/** Clamp `value` into the inclusive range `[lo, hi]`. */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Render optional runtime stack frames, innermost last (per the contract). */
function renderStack(
  frames: readonly StackFrame[],
  color: boolean,
): readonly string[] {
  const out: string[] = [
    paint("stack traceback (innermost last):", BOLD_BLUE, color),
  ];
  for (const frame of frames) {
    const at = `${frame.span.source}:${frame.span.start.line}:${frame.span.start.column}`;
    out.push(`    at ${frame.functionName} (${at})`);
  }
  return out;
}

/**
 * The concrete diagnostic renderer. Stateless; a shared instance is exported as
 * {@link diagnosticFormatter} and the free {@link formatDiagnostic} function.
 */
export class DiagnosticFmt implements DiagnosticFormatter {
  format(
    diagnostic: Diagnostic,
    source: string,
    options?: RenderOptions,
  ): string {
    const color = options?.color ?? false;
    const sevColor = severityColor(diagnostic.severity);
    const { span } = diagnostic;

    const sourceLines = splitLines(source);
    const total = sourceLines.length;

    const startLine = span.start.line;
    const endLine = span.end.line;

    // Half-open [start, end): a span whose end sits at column 1 of a later line
    // does not actually cover that line, so treat the prior line as the last.
    let lastLine = endLine;
    if (endLine > startLine && span.end.column <= 1) {
      lastLine = endLine - 1;
    }
    if (lastLine < startLine) lastLine = startLine;

    // Gutter width is driven by the widest line number actually printed.
    const highestShown = Math.min(
      Math.max(startLine, lastLine),
      Math.max(total, 1),
    );
    const gutterW = String(Math.max(1, highestShown)).length;
    const pad = " ".repeat(gutterW);
    const bar = paint("|", BOLD_BLUE, color);

    const out: string[] = [];

    // 1. Header: `severity[CODE]: message`.
    const tag = paint(
      `${diagnostic.severity}[${diagnostic.code}]`,
      sevColor,
      color,
    );
    out.push(`${tag}: ${diagnostic.message}`);

    // 2. Locator: `<pad>--> source:line:col`, anchored at span.start.
    const arrow = paint("-->", BOLD_BLUE, color);
    out.push(`${pad}${arrow} ${span.source}:${startLine}:${span.start.column}`);

    // 3. Snippet block: opening gutter line, then each covered line + caret run.
    out.push(`${pad} ${bar}`);

    const renderStart = clamp(startLine, 1, total);
    const renderEnd = clamp(lastLine, 1, total);
    const inRange =
      startLine >= 1 && startLine <= total && renderStart <= renderEnd;

    if (!inRange) {
      out.push(`${pad} ${bar} (source unavailable for this span)`);
    } else {
      for (let ln = renderStart; ln <= renderEnd; ln++) {
        const text = sourceLines[ln - 1] ?? "";
        const lineLen = text.length;
        const gutterNum = paint(String(ln).padStart(gutterW), BOLD_BLUE, color);
        out.push(`${gutterNum} ${bar} ${text}`);

        // Caret span for this line (1-based columns, `end` exclusive).
        let caretStart: number;
        let caretEnd: number;
        if (startLine === endLine) {
          caretStart = span.start.column;
          caretEnd = span.end.column;
        } else if (ln === startLine) {
          caretStart = span.start.column;
          caretEnd = lineLen + 1;
        } else if (ln === lastLine) {
          caretStart = 1;
          caretEnd = span.end.column;
        } else {
          caretStart = 1;
          caretEnd = lineLen + 1;
        }

        caretStart = clamp(caretStart, 1, lineLen + 1);
        caretEnd = clamp(caretEnd, caretStart, lineLen + 1);
        const caretLen = Math.max(1, caretEnd - caretStart);
        const indent = " ".repeat(caretStart - 1);
        const carets = paint("^".repeat(caretLen), sevColor, color);
        out.push(`${pad} ${bar} ${indent}${carets}`);
      }
    }

    // 4. Optional runtime stack frames.
    if (diagnostic.stack && diagnostic.stack.length > 0) {
      out.push(...renderStack(diagnostic.stack, color));
    }

    return out.join("\n");
  }
}

/** A ready-to-use shared formatter instance. */
export const diagnosticFormatter: DiagnosticFormatter = new DiagnosticFmt();

/** Convenience wrapper over {@link diagnosticFormatter}. */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  source: string,
  options?: RenderOptions,
): string {
  return diagnosticFormatter.format(diagnostic, source, options);
}
