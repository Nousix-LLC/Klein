/**
 * Math builtins: `abs`, `floor`, `ceil`, `round`, `sqrt`, `min`, `max`, `pow`.
 *
 * All operate on Klein numbers (IEEE-754 doubles) and defer to the host `Math`.
 * Non-finite results are values, not faults: `sqrt(-1)` yields `NaN` and never
 * throws. `min`/`max` are variadic (at least one argument) and propagate `NaN`
 * per `Math.min`/`Math.max`. A non-number argument is
 * {@link ErrorCode.TypeMismatch}. `round` rounds half away from zero for positive
 * inputs (host `Math.round` semantics: ties go toward `+Infinity`).
 */

import { type BuiltinValue, type Span, type Value } from "@contracts";

import { makeNumber } from "../runtime";
import { builtin, expectNumber } from "./helpers";

/** Coerce every argument to a number (else TypeMismatch) and fold with `fn`. */
function foldNumbers(
  label: string,
  args: readonly Value[],
  span: Span,
  fn: (...values: number[]) => number,
): number {
  return fn(...args.map((arg) => expectNumber(label, arg, span).value));
}

export const mathBuiltins: readonly BuiltinValue[] = [
  builtin("abs", 1, 1, (args, _ctx, span) =>
    makeNumber(Math.abs(expectNumber("abs", args[0]!, span).value)),
  ),

  builtin("floor", 1, 1, (args, _ctx, span) =>
    makeNumber(Math.floor(expectNumber("floor", args[0]!, span).value)),
  ),

  builtin("ceil", 1, 1, (args, _ctx, span) =>
    makeNumber(Math.ceil(expectNumber("ceil", args[0]!, span).value)),
  ),

  builtin("round", 1, 1, (args, _ctx, span) =>
    makeNumber(Math.round(expectNumber("round", args[0]!, span).value)),
  ),

  builtin("sqrt", 1, 1, (args, _ctx, span) =>
    makeNumber(Math.sqrt(expectNumber("sqrt", args[0]!, span).value)),
  ),

  builtin("min", 1, null, (args, _ctx, span) =>
    makeNumber(foldNumbers("min", args, span, Math.min)),
  ),

  builtin("max", 1, null, (args, _ctx, span) =>
    makeNumber(foldNumbers("max", args, span, Math.max)),
  ),

  builtin("pow", 2, 2, (args, _ctx, span) =>
    makeNumber(
      Math.pow(
        expectNumber("pow", args[0]!, span).value,
        expectNumber("pow", args[1]!, span).value,
      ),
    ),
  ),
];
