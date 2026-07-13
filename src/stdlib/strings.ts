/**
 * String builtins: `upper`, `lower`, `trim`.
 *
 * Each takes exactly one string and returns a new string (Klein strings are
 * immutable primitives). A non-string argument is {@link ErrorCode.TypeMismatch}.
 * Case mapping and whitespace trimming defer to the host's Unicode-aware
 * `String.prototype` methods.
 */

import { type BuiltinValue } from "@contracts";

import { makeString } from "../runtime";
import { builtin, expectString } from "./helpers";

export const stringBuiltins: readonly BuiltinValue[] = [
  builtin("upper", 1, 1, (args, _ctx, span) =>
    makeString(expectString("upper", args[0]!, span).value.toUpperCase()),
  ),

  builtin("lower", 1, 1, (args, _ctx, span) =>
    makeString(expectString("lower", args[0]!, span).value.toLowerCase()),
  ),

  builtin("trim", 1, 1, (args, _ctx, span) =>
    makeString(expectString("trim", args[0]!, span).value.trim()),
  ),
];
