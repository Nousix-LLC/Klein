/**
 * Conversion builtins: `str`, `num`, `int`, `bool`, `chars`, `ord`, `chr`.
 *
 *   - `str(x)`   — any value to its canonical string form (total; never faults).
 *   - `num(x)`   — number/boolean/numeric-string to a number.
 *   - `int(x)`   — like `num`, then truncated toward zero to an integer.
 *   - `bool(x)`  — any value to a boolean via Klein truthiness (total).
 *   - `chars(s)` — a string to an array of its code-point characters.
 *   - `ord(s)`   — a single-character string to its Unicode code point.
 *   - `chr(n)`   — a code-point integer to its single-character string.
 *
 * Conversion faults: a categorically-unconvertible kind is
 * {@link ErrorCode.TypeMismatch}; a right-kind but out-of-domain *value* (an
 * unparseable numeric string, a non-finite `int`, a multi-character `ord`, an
 * out-of-range `chr`) is {@link ErrorCode.InvalidOperand}. `str` and `bool` are
 * total and never fault. All string handling is by Unicode code point, so `chars`,
 * `ord`, `chr`, and `len` (see `inspection.ts`) agree.
 */

import {
  ValueKind,
  type BuiltinValue,
  type Span,
  type Value,
} from "@contracts";

import {
  isTruthy,
  makeArray,
  makeBoolean,
  makeNumber,
  makeString,
  stringify,
} from "../runtime";
import {
  builtin,
  expectNumber,
  expectString,
  invalidOperand,
  typeMismatch,
} from "./helpers";

/**
 * Core numeric coercion shared by `num` and `int`: numbers pass through; booleans
 * map to `1`/`0`; strings are strictly parsed (leading/trailing whitespace
 * ignored, empty rejected); every other kind is a {@link ErrorCode.TypeMismatch}.
 */
function toNumber(label: string, value: Value, span: Span): number {
  if (value.kind === ValueKind.Number) {
    return value.value;
  }
  if (value.kind === ValueKind.Boolean) {
    return value.value ? 1 : 0;
  }
  if (value.kind === ValueKind.String) {
    const trimmed = value.value.trim();
    if (trimmed === "") {
      return invalidOperand(
        `${label} cannot convert an empty string to a number`,
        span,
      );
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return invalidOperand(
        `${label} cannot convert ${JSON.stringify(value.value)} to a number`,
        span,
      );
    }
    return parsed;
  }
  return typeMismatch(
    `${label} expects a number, boolean, or string, got ${value.kind}`,
    span,
  );
}

export const conversionBuiltins: readonly BuiltinValue[] = [
  builtin("str", 1, 1, (args, _ctx, _span) => makeString(stringify(args[0]!))),

  builtin("num", 1, 1, (args, _ctx, span) =>
    makeNumber(toNumber("num", args[0]!, span)),
  ),

  builtin("int", 1, 1, (args, _ctx, span) => {
    const n = toNumber("int", args[0]!, span);
    if (!Number.isFinite(n)) {
      return invalidOperand(
        `int cannot convert a non-finite number to an integer`,
        span,
      );
    }
    return makeNumber(Math.trunc(n));
  }),

  builtin("bool", 1, 1, (args, _ctx, _span) => makeBoolean(isTruthy(args[0]!))),

  builtin("chars", 1, 1, (args, _ctx, span) => {
    const string = expectString("chars", args[0]!, span);
    return makeArray([...string.value].map((char) => makeString(char)));
  }),

  builtin("ord", 1, 1, (args, _ctx, span) => {
    const string = expectString("ord", args[0]!, span);
    const codePoints = [...string.value];
    if (codePoints.length !== 1) {
      return invalidOperand(
        `ord expects a single-character string, got length ${codePoints.length}`,
        span,
      );
    }
    return makeNumber(codePoints[0]!.codePointAt(0)!);
  }),

  builtin("chr", 1, 1, (args, _ctx, span) => {
    const code = expectNumber("chr", args[0]!, span).value;
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
      return invalidOperand(
        `chr expects an integer code point in [0, 0x10FFFF], got ${code}`,
        span,
      );
    }
    return makeString(String.fromCodePoint(code));
  }),
];
