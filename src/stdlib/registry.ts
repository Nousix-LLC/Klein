/**
 * The standard-library registry — the single roster the `cli` facade installs
 * into a fresh {@link Interpreter}'s global scope via
 * `InterpreterOptions.builtins`.
 *
 * {@link defaultBuiltins} aggregates every category module's builtins into one
 * flat list. Builtin values are immutable and stateless, so the underlying
 * `BuiltinValue` instances are shared across calls; each call returns a **fresh
 * array** so a caller may filter or extend the roster without mutating the shared
 * one. Names are unique across the whole roster — verified mechanically by
 * `tests/stdlib/registry.test.ts`, so a duplicate introduced later fails loudly.
 */

import { type BuiltinValue } from "@contracts";

import { collectionBuiltins } from "./collections";
import { conversionBuiltins } from "./conversions";
import { diagnosticBuiltins } from "./diagnostics";
import { inspectionBuiltins } from "./inspection";
import { ioBuiltins } from "./io";
import { mathBuiltins } from "./math";
import { stringBuiltins } from "./strings";

/** The complete, ordered roster (shared, immutable instances). */
const ROSTER: readonly BuiltinValue[] = [
  ...ioBuiltins,
  ...inspectionBuiltins,
  ...conversionBuiltins,
  ...collectionBuiltins,
  ...stringBuiltins,
  ...mathBuiltins,
  ...diagnosticBuiltins,
];

/**
 * The default Klein standard library: every builtin, as a fresh array the caller
 * owns. Pass to `new Interpreter({ builtins: defaultBuiltins() })`.
 */
export function defaultBuiltins(): BuiltinValue[] {
  return [...ROSTER];
}
