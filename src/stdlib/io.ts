/**
 * I/O builtins: `print`, `println`.
 *
 * Both write to the interpreter-supplied sink via {@link BuiltinContext.write}
 * (never `process.stdout` directly), so the CLI/REPL and tests can redirect
 * output. Each renders its arguments through the runtime's canonical
 * {@link stringify}, joins them with a single space, and returns `null`.
 * `println` differs only by a trailing newline. Both are variadic (zero or more
 * arguments); `print()` writes nothing, `println()` writes just a newline.
 */

import { type BuiltinValue, type Value } from "@contracts";

import { makeNull, stringify } from "../runtime";
import { builtin } from "./helpers";

/** Render args through the canonical stringifier, space-separated. */
function renderArgs(args: readonly Value[]): string {
  return args.map((arg) => stringify(arg)).join(" ");
}

export const ioBuiltins: readonly BuiltinValue[] = [
  builtin("print", 0, null, (args, ctx, _span) => {
    ctx.write(renderArgs(args));
    return makeNull();
  }),

  builtin("println", 0, null, (args, ctx, _span) => {
    ctx.write(`${renderArgs(args)}\n`);
    return makeNull();
  }),
];
