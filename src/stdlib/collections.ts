/**
 * Collection builtins: `push`, `pop`, `slice`, `range`, `map`, `filter`,
 * `reduce`, `sort`, `join`, `split`.
 *
 * Mutation vs. copy (consistent with `docs/LANGUAGE.md` §3, where arrays are
 * reference values):
 *   - `push` and `pop` **mutate the array in place** and are the only mutating
 *     builtins here. `push` returns the (now-longer) array; `pop` returns the
 *     removed element.
 *   - `slice`, `map`, `filter`, and `sort` each return a **fresh** array and never
 *     mutate their input (so `sort` is non-destructive, unlike JS `Array#sort`).
 *
 * Higher-order builtins (`map`, `filter`, `reduce`, and `sort` with a comparator)
 * invoke their callback through {@link BuiltinContext.call}, the interpreter's own
 * call machinery — so a user closure runs with correct lexical scope, stack
 * frames, arity checking ({@link ErrorCode.WrongArgumentCount}), and
 * not-callable detection ({@link ErrorCode.NotCallable}) for free; the stdlib does
 * not re-implement calling.
 */

import {
  ValueKind,
  type BuiltinValue,
  type NumberValue,
  type StringValue,
  type Value,
} from "@contracts";

import {
  isTruthy,
  makeArray,
  makeNumber,
  makeString,
  stringify,
} from "../runtime";
import {
  builtin,
  expectArray,
  expectInteger,
  expectString,
  invalidOperand,
  typeMismatch,
} from "./helpers";

/**
 * Resolve a `[start, end)` window over a sequence of length `len`, JS-`slice`
 * style: a negative index counts from the end, and both bounds clamp into
 * `[0, len]`. A resulting `end < start` yields an empty window.
 */
function clampWindow(
  start: number,
  end: number,
  len: number,
): [number, number] {
  const lo = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
  const hi = end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
  return [lo, hi];
}

/** Lexicographic order for two strings (by UTF-16 code unit), as a sign number. */
function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export const collectionBuiltins: readonly BuiltinValue[] = [
  builtin("push", 2, null, (args, _ctx, span) => {
    const array = expectArray("push", args[0]!, span);
    for (let i = 1; i < args.length; i += 1) {
      array.elements.push(args[i]!);
    }
    return array;
  }),

  builtin("pop", 1, 1, (args, _ctx, span) => {
    const array = expectArray("pop", args[0]!, span);
    if (array.elements.length === 0) {
      return invalidOperand("pop from an empty array", span);
    }
    return array.elements.pop()!;
  }),

  builtin("slice", 2, 3, (args, _ctx, span) => {
    const sequence = args[0]!;
    const start = expectInteger("slice", args[1]!, span);
    if (sequence.kind === ValueKind.Array) {
      const len = sequence.elements.length;
      const end =
        args.length === 3 ? expectInteger("slice", args[2]!, span) : len;
      const [lo, hi] = clampWindow(start, end, len);
      return makeArray(sequence.elements.slice(lo, hi));
    }
    if (sequence.kind === ValueKind.String) {
      const codePoints = [...sequence.value];
      const len = codePoints.length;
      const end =
        args.length === 3 ? expectInteger("slice", args[2]!, span) : len;
      const [lo, hi] = clampWindow(start, end, len);
      return makeString(codePoints.slice(lo, hi).join(""));
    }
    return typeMismatch(
      `slice expects an array or string as its first argument, got ${sequence.kind}`,
      span,
    );
  }),

  builtin("range", 1, 3, (args, _ctx, span) => {
    let start = 0;
    let stop = 0;
    let step = 1;
    if (args.length === 1) {
      stop = expectInteger("range", args[0]!, span);
    } else {
      start = expectInteger("range", args[0]!, span);
      stop = expectInteger("range", args[1]!, span);
      if (args.length === 3) {
        step = expectInteger("range", args[2]!, span);
      }
    }
    if (step === 0) {
      return invalidOperand("range step must not be zero", span);
    }
    const out: Value[] = [];
    if (step > 0) {
      for (let i = start; i < stop; i += step) {
        out.push(makeNumber(i));
      }
    } else {
      for (let i = start; i > stop; i += step) {
        out.push(makeNumber(i));
      }
    }
    return makeArray(out);
  }),

  builtin("map", 2, 2, (args, ctx, span) => {
    const array = expectArray("map", args[0]!, span);
    const fn = args[1]!;
    return makeArray(
      array.elements.map((element) => ctx.call(fn, [element], span)),
    );
  }),

  builtin("filter", 2, 2, (args, ctx, span) => {
    const array = expectArray("filter", args[0]!, span);
    const predicate = args[1]!;
    return makeArray(
      array.elements.filter((element) =>
        isTruthy(ctx.call(predicate, [element], span)),
      ),
    );
  }),

  builtin("reduce", 3, 3, (args, ctx, span) => {
    const array = expectArray("reduce", args[0]!, span);
    const fn = args[1]!;
    let accumulator = args[2]!;
    for (const element of array.elements) {
      accumulator = ctx.call(fn, [accumulator, element], span);
    }
    return accumulator;
  }),

  builtin("sort", 1, 2, (args, ctx, span) => {
    const array = expectArray("sort", args[0]!, span);
    const copy = [...array.elements];
    if (args.length === 2) {
      const comparator = args[1]!;
      copy.sort((left, right) => {
        const result = ctx.call(comparator, [left, right], span);
        if (result.kind !== ValueKind.Number) {
          return typeMismatch(
            `sort comparator must return a number, got ${result.kind}`,
            span,
          );
        }
        return result.value;
      });
      return makeArray(copy);
    }
    // No comparator: only a homogeneous all-number or all-string array has a
    // well-defined natural order.
    const allNumbers = copy.every(
      (element) => element.kind === ValueKind.Number,
    );
    const allStrings = copy.every(
      (element) => element.kind === ValueKind.String,
    );
    if (!allNumbers && !allStrings) {
      return invalidOperand(
        "sort without a comparator requires all-number or all-string elements",
        span,
      );
    }
    copy.sort(
      allNumbers
        ? (left, right) =>
            (left as NumberValue).value - (right as NumberValue).value
        : (left, right) =>
            compareStrings(
              (left as StringValue).value,
              (right as StringValue).value,
            ),
    );
    return makeArray(copy);
  }),

  builtin("join", 1, 2, (args, _ctx, span) => {
    const array = expectArray("join", args[0]!, span);
    const separator =
      args.length === 2 ? expectString("join", args[1]!, span).value : "";
    return makeString(
      array.elements.map((element) => stringify(element)).join(separator),
    );
  }),

  builtin("split", 1, 2, (args, _ctx, span) => {
    const string = expectString("split", args[0]!, span);
    const separator =
      args.length === 2 ? expectString("split", args[1]!, span).value : "";
    // An empty separator splits into code-point characters (like `chars`).
    const parts =
      separator === "" ? [...string.value] : string.value.split(separator);
    return makeArray(parts.map((part) => makeString(part)));
  }),
];
