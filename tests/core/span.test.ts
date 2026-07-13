import { describe, it, expect } from "vitest";

import type { Position, Span } from "@contracts";
import {
  makePosition,
  makeSpan,
  mergeSpans,
  pointSpan,
  spanLength,
} from "../../src/core/span";

const SOURCE = "test.kl";

/** Build a Position at `offset` on `line`, deriving a 1-based column from offset. */
const pos = (offset: number, line = 1, column = offset + 1): Position =>
  makePosition(offset, line, column);

/** Build a Span [start, end) in `source` (default SOURCE) from two offsets. */
const span = (startOffset: number, endOffset: number, source = SOURCE): Span =>
  makeSpan(pos(startOffset), pos(endOffset), source);

describe("makePosition", () => {
  it("round-trips its three coordinates", () => {
    const p = makePosition(12, 3, 5);
    expect(p).toEqual({ offset: 12, line: 3, column: 5 });
  });

  it("preserves each field independently", () => {
    const p = makePosition(0, 1, 1);
    expect(p.offset).toBe(0);
    expect(p.line).toBe(1);
    expect(p.column).toBe(1);
  });
});

describe("makeSpan", () => {
  it("round-trips start, end, and source without reordering", () => {
    const start = makePosition(4, 1, 5);
    const end = makePosition(9, 1, 10);
    const s = makeSpan(start, end, SOURCE);
    expect(s.start).toBe(start);
    expect(s.end).toBe(end);
    expect(s.source).toBe(SOURCE);
  });

  it("keeps the caller's ordering even when start is after end", () => {
    const s = makeSpan(pos(9), pos(4), SOURCE);
    expect(s.start.offset).toBe(9);
    expect(s.end.offset).toBe(4);
  });
});

describe("pointSpan", () => {
  it("produces a zero-width span anchored at the position", () => {
    const at = makePosition(7, 2, 3);
    const s = pointSpan(at, SOURCE);
    expect(s.start).toBe(at);
    expect(s.end).toBe(at);
    expect(s.source).toBe(SOURCE);
    expect(spanLength(s)).toBe(0);
  });
});

describe("mergeSpans", () => {
  it("covers two disjoint spans (a before b)", () => {
    const merged = mergeSpans(span(0, 3), span(5, 8));
    expect(merged.start.offset).toBe(0);
    expect(merged.end.offset).toBe(8);
    expect(merged.source).toBe(SOURCE);
  });

  it("is order-insensitive (b before a yields the same range)", () => {
    const forward = mergeSpans(span(0, 3), span(5, 8));
    const reversed = mergeSpans(span(5, 8), span(0, 3));
    expect(reversed.start.offset).toBe(forward.start.offset);
    expect(reversed.end.offset).toBe(forward.end.offset);
  });

  it("covers overlapping spans", () => {
    const merged = mergeSpans(span(0, 6), span(4, 10));
    expect(merged.start.offset).toBe(0);
    expect(merged.end.offset).toBe(10);
  });

  it("returns an equivalent range for two identical spans", () => {
    const merged = mergeSpans(span(2, 5), span(2, 5));
    expect(merged.start.offset).toBe(2);
    expect(merged.end.offset).toBe(5);
  });

  it("takes the widest bounds when one span contains the other", () => {
    const outerFirst = mergeSpans(span(0, 12), span(3, 7));
    expect(outerFirst.start.offset).toBe(0);
    expect(outerFirst.end.offset).toBe(12);

    const innerFirst = mergeSpans(span(3, 7), span(0, 12));
    expect(innerFirst.start.offset).toBe(0);
    expect(innerFirst.end.offset).toBe(12);
  });

  it("keeps the first span's source on a source mismatch (documented choice)", () => {
    const merged = mergeSpans(span(0, 3, "a.kl"), span(5, 8, "b.kl"));
    expect(merged.source).toBe("a.kl");
  });
});

describe("spanLength", () => {
  it("measures the half-open extent in code units", () => {
    expect(spanLength(span(4, 9))).toBe(5);
  });

  it("is zero for a point span", () => {
    expect(spanLength(span(6, 6))).toBe(0);
  });

  it("is negative for a reversed range rather than throwing", () => {
    expect(spanLength(makeSpan(pos(9), pos(4), SOURCE))).toBe(-5);
  });
});
