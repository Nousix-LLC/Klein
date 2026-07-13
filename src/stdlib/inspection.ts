/**
 * Inspection builtins: `len`, `type`, `keys`, `values`, `has`, `contains`.
 *
 * These read structure out of a value without mutating it:
 *   - `len(x)`       — element/entry/character count of a string, array, or object.
 *   - `type(x)`      — the value's kind as a string (the `ValueKind` tag).
 *   - `keys(o)`      — an object's keys, in insertion order, as an array of strings.
 *   - `values(o)`    — an object's values, in insertion order, as a fresh array.
 *   - `has(o, k)`    — whether object `o` has string key `k`.
 *   - `contains(c,x)`— array membership (by Klein `==`) or string substring test.
 *
 * String length and iteration are by **Unicode code point** (`[...s]`), so `len`
 * agrees with `chars` and with `ord`/`chr` (see `conversions.ts`).
 */

import { ValueKind, type BuiltinValue } from "@contracts";

import {
  makeArray,
  makeBoolean,
  makeNumber,
  makeString,
  valuesEqual,
} from "../runtime";
import { builtin, expectObject, expectString, typeMismatch } from "./helpers";

export const inspectionBuiltins: readonly BuiltinValue[] = [
  builtin("len", 1, 1, (args, _ctx, span) => {
    const value = args[0]!;
    if (value.kind === ValueKind.String) {
      return makeNumber([...value.value].length);
    }
    if (value.kind === ValueKind.Array) {
      return makeNumber(value.elements.length);
    }
    if (value.kind === ValueKind.Object) {
      return makeNumber(value.entries.size);
    }
    return typeMismatch(
      `len expects a string, array, or object, got ${value.kind}`,
      span,
    );
  }),

  builtin("type", 1, 1, (args, _ctx, _span) => makeString(args[0]!.kind)),

  builtin("keys", 1, 1, (args, _ctx, span) => {
    const object = expectObject("keys", args[0]!, span);
    return makeArray([...object.entries.keys()].map((key) => makeString(key)));
  }),

  builtin("values", 1, 1, (args, _ctx, span) => {
    const object = expectObject("values", args[0]!, span);
    // Fresh backing array: mutating the result must not alias the object.
    return makeArray([...object.entries.values()]);
  }),

  builtin("has", 2, 2, (args, _ctx, span) => {
    const object = expectObject("has", args[0]!, span);
    const key = expectString("has", args[1]!, span);
    return makeBoolean(object.entries.has(key.value));
  }),

  builtin("contains", 2, 2, (args, _ctx, span) => {
    const container = args[0]!;
    const target = args[1]!;
    if (container.kind === ValueKind.Array) {
      return makeBoolean(
        container.elements.some((element) => valuesEqual(element, target)),
      );
    }
    if (container.kind === ValueKind.String) {
      const substring = expectString("contains", target, span);
      return makeBoolean(container.value.includes(substring.value));
    }
    return typeMismatch(
      `contains expects an array or string as its first argument, got ${container.kind}`,
      span,
    );
  }),
];
