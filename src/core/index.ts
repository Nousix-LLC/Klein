/**
 * `@core` public barrel — the shared runtime core every later Klein pipeline
 * stage (lexer → parser → runtime → cli) imports:
 *
 *     import { makeSpan, LexicalError, formatDiagnostic } from "@core";
 *
 * It re-exports exactly the intended public surface of the three core modules and
 * nothing else:
 *   - span geometry helpers          (./span)
 *   - the concrete Klein error classes + their base (./errors)
 *   - the `DiagnosticFormatter` implementation and its render options (./diagnostic)
 *
 * The shared *contract types* (`Span`, `Position`, `ErrorCode`, `Diagnostic`,
 * `KleinError`, `DiagnosticFormatter`, …) are intentionally NOT re-exported here:
 * they live in `contracts/` and downstream code imports them literally from
 * `@contracts`, keeping a single source of truth for the vocabulary and `@core`
 * for the behavior that implements it.
 *
 * This file is a pure re-export barrel — it carries no logic and is excluded from
 * coverage per `vitest.config.ts`.
 */

// --- Source span / position geometry (pure, total helpers) ---
export {
  makePosition,
  makeSpan,
  pointSpan,
  mergeSpans,
  spanLength,
} from "./span";

// --- Concrete, source-anchored error classes (real `Error` subclasses that also
// structurally satisfy `contracts/errors.ts#KleinError`). Class names re-export
// both the runtime value and its instance type. ---
export { KleinErrorBase, LexicalError, SyntaxErr, RuntimeErr } from "./errors";

// --- Diagnostic renderer: the `DiagnosticFormatter` implementation, a shared
// instance, and the free-function convenience wrapper. ---
export {
  DiagnosticFmt,
  diagnosticFormatter,
  formatDiagnostic,
} from "./diagnostic";

// `RenderOptions` is a type-only surface; re-export it as a type so the barrel
// stays erasable under `isolatedModules`.
export type { RenderOptions } from "./diagnostic";
