/**
 * Shared plumbing for the Klein standard library.
 *
 * Every builtin in this subtree is a {@link BuiltinImpl} wrapped in a
 * {@link BuiltinValue} with a declared {@link Arity}. Two concerns are common to
 * all of them and live here so no category module re-derives them:
 *
 *   1. **The `builtin` factory** — a thin, typed wrapper over the runtime's
 *      `makeBuiltin` constructor that takes an inline `(min, max)` arity, so a
 *      category module reads as a flat table of `builtin(name, min, max, impl)`
 *      rows.
 *   2. **Argument-type assertions** — the `expect*` helpers narrow a `Value` to a
 *      specific kind or throw the correct, source-anchored {@link RuntimeErr}. A
 *      wrong *kind* is {@link ErrorCode.TypeMismatch}; a right-kind-but-bad-*value*
 *      (a non-integer where an integer is required) is
 *      {@link ErrorCode.InvalidOperand}. These are the only two argument-fault
 *      codes the stdlib raises, per the `stdlib` brief.
 *
 * Invariants this module relies on (from `contracts/values.ts` and the runtime):
 *   - The interpreter enforces a builtin's declared arity *before* invoking its
 *     `impl`, so `impl` bodies may index `args` positionally within range.
 *   - A builtin signals a Klein-level fault by **throwing a `RuntimeErr`** with no
 *     call stack; the interpreter's `applyBuiltin` attaches the live Klein call
 *     stack, so builtin faults are anchored exactly like every other runtime
 *     error. A builtin therefore never leaks a raw JS `Error`.
 *
 * The `typeMismatch` / `invalidOperand` throwers return `never`, so a call to one
 * both raises the fault and narrows control flow for the type-checker — an
 * `expect*` helper can call it in the failure branch and return the narrowed value
 * in the success branch with no redundant `throw`.
 */

import {
  ErrorCode,
  ValueKind,
  type ArrayValue,
  type BuiltinImpl,
  type BuiltinValue,
  type NumberValue,
  type ObjectValue,
  type Span,
  type StringValue,
  type Value,
} from "@contracts";
import { RuntimeErr } from "@core";

import { makeBuiltin } from "../runtime";

/**
 * Build a {@link BuiltinValue} from a name, an inline arity `(min, max)`, and an
 * implementation. `max === null` means variadic (no upper bound). Kept trivial on
 * purpose: it exists so category modules declare builtins as a readable table.
 */
export function builtin(
  name: string,
  min: number,
  max: number | null,
  impl: BuiltinImpl,
): BuiltinValue {
  return makeBuiltin(name, { min, max }, impl);
}

/** Throw a {@link ErrorCode.TypeMismatch} runtime fault anchored at `span`. */
export function typeMismatch(message: string, span: Span): never {
  throw new RuntimeErr(ErrorCode.TypeMismatch, message, span);
}

/** Throw a {@link ErrorCode.InvalidOperand} runtime fault anchored at `span`. */
export function invalidOperand(message: string, span: Span): never {
  throw new RuntimeErr(ErrorCode.InvalidOperand, message, span);
}

/** Narrow `value` to a {@link NumberValue}, else {@link ErrorCode.TypeMismatch}. */
export function expectNumber(
  label: string,
  value: Value,
  span: Span,
): NumberValue {
  if (value.kind !== ValueKind.Number) {
    typeMismatch(`${label} expects a number, got ${value.kind}`, span);
  }
  return value;
}

/** Narrow `value` to a {@link StringValue}, else {@link ErrorCode.TypeMismatch}. */
export function expectString(
  label: string,
  value: Value,
  span: Span,
): StringValue {
  if (value.kind !== ValueKind.String) {
    typeMismatch(`${label} expects a string, got ${value.kind}`, span);
  }
  return value;
}

/** Narrow `value` to an {@link ArrayValue}, else {@link ErrorCode.TypeMismatch}. */
export function expectArray(
  label: string,
  value: Value,
  span: Span,
): ArrayValue {
  if (value.kind !== ValueKind.Array) {
    typeMismatch(`${label} expects an array, got ${value.kind}`, span);
  }
  return value;
}

/** Narrow `value` to an {@link ObjectValue}, else {@link ErrorCode.TypeMismatch}. */
export function expectObject(
  label: string,
  value: Value,
  span: Span,
): ObjectValue {
  if (value.kind !== ValueKind.Object) {
    typeMismatch(`${label} expects an object, got ${value.kind}`, span);
  }
  return value;
}

/**
 * Require `value` to be an **integer** number: a wrong kind is
 * {@link ErrorCode.TypeMismatch}; a non-integer number (fractional, `NaN`, or
 * `±Infinity`) is {@link ErrorCode.InvalidOperand}. Returns the raw JS number.
 */
export function expectInteger(label: string, value: Value, span: Span): number {
  const n = expectNumber(label, value, span).value;
  if (!Number.isInteger(n)) {
    invalidOperand(`${label} expects an integer, got ${n}`, span);
  }
  return n;
}
