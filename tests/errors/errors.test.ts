/**
 * End-to-end suite for the `error` examples (`kind: "error"` in
 * `examples/index.json`).
 *
 * For every committed faulty program this drives the **real** pipeline via
 * `interpret()` and asserts the diagnostics **structurally**:
 *   • the run fails — `ok === false`, at least one diagnostic;
 *   • `diagnostics.map(d => d.code)` deep-equals the manifest's `expectedCodes`,
 *     in source order (keyed off `ErrorCode`, never message text);
 *   • every diagnostic is source-anchored — it carries a `span`;
 *   • each diagnostic renders (via the shared `@core` `formatDiagnostic`, color
 *     off) to a human diagnostic containing a source snippet, a `^` caret, and a
 *     `--> name:line:col` location; and
 *   • the full rendered block is **byte-exact** equal to the committed
 *     `examples/<name>.diag` golden (a snapshot of real, generated output).
 *
 * Fully data-driven from the manifest — no per-example expectation is hard-coded.
 */

import { describe, expect, it } from "vitest";

import {
  entriesOfKind,
  readDiagGolden,
  readSource,
  renderDiagnostics,
  runExample,
} from "../integration/harness";

const errorExamples = entriesOfKind("error");

describe("examples — error programs emit exactly their expected diagnostics", () => {
  it("has at least one error example to exercise", () => {
    expect(errorExamples.length).toBeGreaterThan(0);
  });

  it("every error entry declares its expectedCodes", () => {
    for (const entry of errorExamples) {
      expect(Array.isArray(entry.expectedCodes)).toBe(true);
      expect(entry.expectedCodes?.length).toBeGreaterThan(0);
    }
  });

  it.each(errorExamples.map((entry) => entry.name))(
    "reports the exact ordered ErrorCodes for %s with source-anchored, rendered diagnostics",
    (name) => {
      const entry = errorExamples.find((candidate) => candidate.name === name);
      // Present by construction (name came from this same list); assert to narrow.
      expect(entry).toBeDefined();
      const expectedCodes = entry?.expectedCodes ?? [];

      const { outcome } = runExample(name);

      // The run must fail and produce diagnostics.
      expect(outcome.ok).toBe(false);
      expect(outcome.diagnostics.length).toBeGreaterThan(0);

      // Structured, ordered code assertion — the heart of the contract.
      const codes = outcome.diagnostics.map((diagnostic) => diagnostic.code);
      expect(codes).toEqual(expectedCodes);

      // Every diagnostic is source-anchored: it carries a span with real offsets.
      for (const diagnostic of outcome.diagnostics) {
        expect(diagnostic.span).toBeDefined();
        expect(typeof diagnostic.span.start.offset).toBe("number");
        expect(typeof diagnostic.span.end.offset).toBe("number");
      }

      // Each diagnostic renders to a real snippet + caret + location.
      const source = readSource(name);
      for (const diagnostic of outcome.diagnostics) {
        const rendered = renderDiagnostics([diagnostic], source);
        expect(rendered).toContain(`[${diagnostic.code}]`);
        expect(rendered).toContain("-->");
        expect(rendered).toMatch(/:\d+:\d+/); // name:line:col
        expect(rendered).toContain("^"); // caret underline
      }

      // The full rendered block matches the committed golden byte-for-byte —
      // exactly the stderr the shipped CLI produces for this program.
      expect(renderDiagnostics(outcome.diagnostics, source)).toBe(
        readDiagGolden(name),
      );
    },
  );
});
