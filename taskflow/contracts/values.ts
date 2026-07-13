/**
 * CONTRACT — Runtime value model, environment, builtin, and interpreter interfaces.
 *
 * READ-ONLY. Declares the shape of every runtime value, the scope (Environment)
 * interface, the builtin-function calling convention, and the Interpreter
 * surface. The `runtime` task provides the concrete Environment + Interpreter
 * implementations and value constructors; the `stdlib` task authors builtins
 * against `BuiltinImpl`/`BuiltinContext`; the `cli` task drives `Interpreter`.
 *
 * Import, do not re-declare:
 *     import { Value, ValueKind, Environment, BuiltinImpl } from "../../contracts/values";
 *
 * Amendments are additive only.
 */

import { Span } from "./tokens";
import { FunctionNode, Program } from "./ast";

/** Discriminant for the tagged `Value` union. String-valued for stable output. */
export enum ValueKind {
  Null = "null",
  Boolean = "boolean",
  Number = "number",
  String = "string",
  Array = "array",
  Object = "object",
  Function = "function",
  Builtin = "builtin",
}

export interface NullValue {
  readonly kind: ValueKind.Null;
}

export interface BooleanValue {
  readonly kind: ValueKind.Boolean;
  readonly value: boolean;
}

export interface NumberValue {
  readonly kind: ValueKind.Number;
  readonly value: number;
}

export interface StringValue {
  readonly kind: ValueKind.String;
  readonly value: string;
}

/** Arrays are mutable reference values (push/pop/index-assign mutate in place). */
export interface ArrayValue {
  readonly kind: ValueKind.Array;
  readonly elements: Value[];
}

/**
 * Objects are mutable string-keyed maps. A Map (not a plain object) is mandated
 * so key ordering is insertion-ordered and there is no prototype-pollution or
 * collision with JS object internals.
 */
export interface ObjectValue {
  readonly kind: ValueKind.Object;
  readonly entries: Map<string, Value>;
}

/** A user-defined function closed over its defining environment. */
export interface FunctionValue {
  readonly kind: ValueKind.Function;
  readonly node: FunctionNode;
  readonly closure: Environment;
  /** Name for diagnostics/stack frames; null for anonymous function literals. */
  readonly name: string | null;
}

/** Accepted arities for a builtin. `max: null` means variadic (no upper bound). */
export interface Arity {
  readonly min: number;
  readonly max: number | null;
}

/** A builtin (native) function value. */
export interface BuiltinValue {
  readonly kind: ValueKind.Builtin;
  readonly name: string;
  readonly arity: Arity;
  readonly impl: BuiltinImpl;
}

export type Value =
  | NullValue
  | BooleanValue
  | NumberValue
  | StringValue
  | ArrayValue
  | ObjectValue
  | FunctionValue
  | BuiltinValue;

// ─────────────────────────────────────────────────────────────────────────────
// Environment (lexical scope chain)
// ─────────────────────────────────────────────────────────────────────────────

export interface Environment {
  /** The enclosing scope, or null for the global scope. */
  readonly parent: Environment | null;

  /** Bind a name in THIS scope, shadowing any outer binding. */
  define(name: string, value: Value): void;

  /** Look up a name across the scope chain. Throws RuntimeError (UndefinedVariable) if unbound. */
  get(name: string, span: Span): Value;

  /**
   * Assign to an EXISTING binding, searching outward. Throws RuntimeError
   * (UndefinedVariable) if the name is not bound anywhere in the chain.
   */
  assign(name: string, value: Value, span: Span): void;

  /** True if `name` is bound anywhere in the chain. */
  has(name: string): boolean;

  /** Create a nested child scope whose parent is this environment. */
  child(): Environment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builtin calling convention
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The capabilities a builtin receives from the interpreter: a stdout sink and a
 * re-entrant call hook (so higher-order builtins like `map`/`filter` can invoke
 * user functions through the same evaluation machinery, preserving stack frames
 * and error handling).
 */
export interface BuiltinContext {
  /** Write text to the configured output sink (no implicit newline). */
  write(text: string): void;
  /** Call any callable value (function or builtin) with already-evaluated args. */
  call(callee: Value, args: readonly Value[], span: Span): Value;
}

/**
 * A builtin implementation. Argument count is guaranteed by the interpreter to
 * satisfy the declared `Arity` before `impl` is invoked, so implementations may
 * assume `args.length` is in range. `span` is the call site, for diagnostics.
 * A builtin signals a Klein-level error by throwing a RuntimeError.
 */
export type BuiltinImpl = (
  args: readonly Value[],
  ctx: BuiltinContext,
  span: Span,
) => Value;

// ─────────────────────────────────────────────────────────────────────────────
// Interpreter surface
// ─────────────────────────────────────────────────────────────────────────────

export interface InterpreterOptions {
  /** Output sink for `print`/`println`. Defaults to writing to process.stdout. */
  readonly write?: (text: string) => void;
  /** Builtins to install into the global scope. Defaults to the full stdlib. */
  readonly builtins?: Iterable<BuiltinValue>;
  /** Max user-function call depth before StackOverflow. Defaults to a safe value. */
  readonly maxCallDepth?: number;
}

export interface Interpreter {
  /** The global (outermost) scope, with builtins installed. */
  readonly globals: Environment;
  /**
   * Evaluate a whole program, returning the value of its final expression
   * statement (or null). Throws RuntimeError on the first runtime fault.
   */
  run(program: Program): Value;
}
