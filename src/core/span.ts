/**
 * Source position & span helpers — the thin, pure geometry layer every Klein
 * pipeline stage builds source ranges with.
 *
 * These functions are total (no throw on ordinary inputs) and immutable: they
 * only ever read the read-only `Position`/`Span` shapes from `contracts/tokens.ts`
 * and return fresh values that conform to them. The contract types are imported
 * literally — never re-declared here.
 *
 * Positions use a 0-based `offset` (index into the source string) alongside a
 * 1-based `line`/`column`; spans are half-open `[start, end)` plus a logical
 * `source` name (a file path, or "<repl>"/"<stdin>").
 */

import type { Position, Span } from "@contracts";

/**
 * Construct a {@link Position}. The caller is responsible for the offset/line/
 * column being mutually consistent for the source being scanned; this helper
 * performs no validation (it is a pure record constructor).
 */
export function makePosition(
  offset: number,
  line: number,
  column: number,
): Position {
  return { offset, line, column };
}

/**
 * Construct a {@link Span} covering `[start, end)` within `source`. `start` is
 * expected to be at or before `end`; the constructor does not reorder them (use
 * {@link mergeSpans} when order is unknown).
 */
export function makeSpan(start: Position, end: Position, source: string): Span {
  return { start, end, source };
}

/**
 * A zero-width span anchored at a single {@link Position} (`start === end`).
 * Useful for diagnostics that point at a caret with no extent — e.g. an
 * unexpected end-of-input or a missing token.
 */
export function pointSpan(at: Position, source: string): Span {
  return { start: at, end: at, source };
}

/**
 * The smallest span covering both `a` and `b`: the earlier `start` and the later
 * `end` (compared by `offset`). This is the workhorse used to grow a range as a
 * stage consumes tokens (e.g. `merge(firstToken.span, lastToken.span)`).
 *
 * Order-insensitive: `mergeSpans(a, b)` and `mergeSpans(b, a)` yield the same
 * range. Spans are assumed to share a `source`; merging is only meaningful
 * within one source, so `a.source` is kept as a deterministic, documented choice
 * when the two differ (rather than throwing — this helper is total).
 */
export function mergeSpans(a: Span, b: Span): Span {
  const start = a.start.offset <= b.start.offset ? a.start : b.start;
  const end = a.end.offset >= b.end.offset ? a.end : b.end;
  return { start, end, source: a.source };
}

/**
 * The length of a span in UTF-16 code units (`end.offset - start.offset`).
 * Zero for a {@link pointSpan}. Never negative for a well-formed span; a caller
 * that hands in a reversed range gets a negative number back rather than a throw.
 */
export function spanLength(span: Span): number {
  return span.end.offset - span.start.offset;
}
