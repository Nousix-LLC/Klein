/**
 * `src/stdlib` public barrel — the Klein standard library.
 *
 * The primary export is {@link defaultBuiltins}, the roster the `cli` facade
 * installs into the interpreter's globals. The per-category builtin arrays are
 * also re-exported so tests (and any future selective installer) can reference a
 * single category without pulling the whole roster.
 *
 * This file is a pure re-export barrel (no logic) and is excluded from coverage
 * per `vitest.config.ts`.
 */

export { defaultBuiltins } from "./registry";

export { ioBuiltins } from "./io";
export { inspectionBuiltins } from "./inspection";
export { conversionBuiltins } from "./conversions";
export { collectionBuiltins } from "./collections";
export { stringBuiltins } from "./strings";
export { mathBuiltins } from "./math";
export { diagnosticBuiltins } from "./diagnostics";
