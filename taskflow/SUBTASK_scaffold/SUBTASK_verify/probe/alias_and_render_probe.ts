/**
 * verify-probe: proves (a) `@core` and `@contracts` path aliases resolve at
 * RUNTIME (not just under tsc), and (b) the diagnostic renderer owned by
 * `src/core/diagnostic.ts` reproduces the snippet+caret layout fixed by
 * `contracts/errors.ts`. Run via the project's tsx from the project root so the
 * project tsconfig `paths` are in effect — the same resolution the eventual
 * `klein` bin relies on. This file lives in the verifier's OWN workspace; it
 * writes no project file.
 */
import {
  makeSpan,
  RuntimeErr,
  formatDiagnostic,
  KleinErrorBase,
} from "@core";
import { ErrorCode, type Diagnostic, type KleinError } from "@contracts";

// The exact source used in the contracts/errors.ts docstring example.
const source = ["let x = 1;", "let z = 2;", "  let y = foo + 1;"].join("\n");
// span over `foo` on line 3 (1-based line 3, column 11), 3 chars wide.
const start = { offset: source.indexOf("foo"), line: 3, column: 11 };
const span = makeSpan(start, {
  offset: start.offset + 3,
  line: 3,
  column: 14,
});

const err: KleinError = new RuntimeErr(
  ErrorCode.UndefinedVariable,
  "undefined variable 'foo'",
  span,
);

// (a) instanceof Error + structural KleinError both hold
console.log("ALIAS_RUNTIME_OK: imported @core + @contracts at runtime");
console.log("instanceof Error       :", err instanceof Error);
console.log("instanceof KleinErrorBase:", err instanceof KleinErrorBase);
console.log("code is ErrorCode enum :", err.code === ErrorCode.UndefinedVariable);
console.log("carries span           :", err.span.start.line === 3);

const diag: Diagnostic = err.toDiagnostic();
console.log("phase (class-fixed)    :", diag.phase);
console.log("--- rendered diagnostic (color off) ---");
console.log(formatDiagnostic(diag, source, { color: false }));
console.log("--- end rendered ---");
