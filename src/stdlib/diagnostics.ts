/**
 * Diagnostic builtins: `assert`, `error`, `clock`.
 *
 *   - `assert(cond)` / `assert(cond, msg)` — if `cond` is falsy (only `null` and
 *     `false` are), throw {@link ErrorCode.AssertionFailed}; otherwise return
 *     `null`. An optional second argument is stringified into the message (any
 *     kind is accepted).
 *   - `error(msg)` — unconditionally throw {@link ErrorCode.UserError} with the
 *     string `msg`; a non-string `msg` is {@link ErrorCode.TypeMismatch}. This is
 *     the program-level "raise an error" primitive.
 *   - `clock()` — wall-clock time in fractional seconds since the Unix epoch, as a
 *     number. Non-deterministic by nature; useful for timing.
 *
 * `assert` and `error` throw a {@link RuntimeErr} with no call stack; the
 * interpreter attaches the live Klein call stack when the builtin unwinds, so
 * these faults are source-anchored and carry a stack like any other runtime error.
 */

import { ErrorCode, type BuiltinValue } from "@contracts";
import { RuntimeErr } from "@core";

import { isTruthy, makeNull, makeNumber, stringify } from "../runtime";
import { builtin, expectString } from "./helpers";

export const diagnosticBuiltins: readonly BuiltinValue[] = [
  builtin("assert", 1, 2, (args, _ctx, span) => {
    if (!isTruthy(args[0]!)) {
      const message =
        args.length === 2 ? stringify(args[1]!) : "assertion failed";
      throw new RuntimeErr(ErrorCode.AssertionFailed, message, span);
    }
    return makeNull();
  }),

  builtin("error", 1, 1, (args, _ctx, span) => {
    const message = expectString("error", args[0]!, span);
    throw new RuntimeErr(ErrorCode.UserError, message.value, span);
  }),

  builtin("clock", 0, 0, (_args, _ctx, _span) => makeNumber(Date.now() / 1000)),
];
