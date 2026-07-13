/**
 * Klein value system — the concrete realization of the `Value` union declared in
 * `contracts/values.ts`.
 *
 * This module is the runtime's **value model** and owns four cohesive concerns,
 * all of which operate over the single `Value` discriminated union:
 *
 *   1. **Constructors** — small, total factory functions producing contract-shaped
 *      `readonly` values, one per `ValueKind`. `null`/`true`/`false` are shared
 *      singletons (safe: primitives compare structurally, not by reference), while
 *      every compound value (`array`, `object`, `function`, `builtin`) is a fresh
 *      object so the reference-identity equality rule holds.
 *   2. **Truthiness** — the Klein rule: ONLY `null` and `false` are falsy; every
 *      other value (including `0`, `""`, `[]`, `{}`) is truthy.
 *   3. **Structural equality** (`==`/`!=`) — value equality for primitives
 *      (`null`, boolean, number, string; number equality is IEEE-754, so
 *      `NaN != NaN`), reference identity for arrays/objects/functions/builtins,
 *      and `false` across differing kinds (never an error).
 *   4. **The canonical value stringifier** — the single source of truth for
 *      rendering a `Value` as text (used later by `print`/REPL/diagnostics).
 *
 * It is a leaf module: it imports the contract literally plus `RuntimeErr`-free
 * `@core` vocabulary only, and depends on neither `Environment`'s concrete
 * implementation nor the evaluator (both sibling tasks). The `FunctionValue`
 * `node`/`closure` fields are stored opaquely — this module never inspects them.
 *
 * Number rendering: values are printed with JavaScript's shortest round-tripping
 * representation (`String(n)`), which renders integral doubles without a trailing
 * `.0` (`3`, not `3.0`) per `docs/LANGUAGE.md#numbers`, and yields `NaN`,
 * `Infinity`, `-Infinity` for the non-finite doubles.
 *
 * String rendering & nested quoting (an implementation decision the language spec
 * leaves open, fixed here and documented): a string in **value position**
 * (top level) renders as its raw contents, so `print("hi")` shows `hi`. A string
 * **nested** inside an array or object renders as a double-quoted literal with
 * escapes (matching the lexer's escape table), so `[1, "1"]` is unambiguous and
 * distinguishable from `[1, 1]`. Object keys render bare (unquoted) as their raw
 * string, giving the documented `{ key: value }` shape.
 */

import {
  ValueKind,
  type Arity,
  type BooleanValue,
  type BuiltinImpl,
  type BuiltinValue,
  type Environment,
  type FunctionNode,
  type FunctionValue,
  type NullValue,
  type NumberValue,
  type ObjectValue,
  type StringValue,
  type ArrayValue,
  type Value,
} from "@contracts";

// ─────────────────────────────────────────────────────────────────────────────
// Constructors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single `null` value. `null` and the two booleans are shared singletons:
 * because primitives compare structurally (by value), sharing one instance can
 * never violate the reference-identity rule that governs compound values.
 */
export const NULL: NullValue = { kind: ValueKind.Null };

/** The shared `true` value. */
export const TRUE: BooleanValue = { kind: ValueKind.Boolean, value: true };

/** The shared `false` value. */
export const FALSE: BooleanValue = { kind: ValueKind.Boolean, value: false };

/** The `null` value (always the shared {@link NULL} singleton). */
export function makeNull(): NullValue {
  return NULL;
}

/** The boolean value for `value` (the shared {@link TRUE}/{@link FALSE} singleton). */
export function makeBoolean(value: boolean): BooleanValue {
  return value ? TRUE : FALSE;
}

/** A number value wrapping the IEEE-754 double `value`. */
export function makeNumber(value: number): NumberValue {
  return { kind: ValueKind.Number, value };
}

/** A string value wrapping `value`. */
export function makeString(value: string): StringValue {
  return { kind: ValueKind.String, value };
}

/**
 * An array value backed by `elements`. The array is a **mutable reference value**:
 * the given backing array is stored by reference (not copied), so builtins that
 * grow/shrink/index-assign mutate it in place and aliases observe the change.
 * Each call with no argument creates a fresh, independent empty array.
 */
export function makeArray(elements: Value[] = []): ArrayValue {
  return { kind: ValueKind.Array, elements };
}

/**
 * An object value backed by an insertion-ordered `Map`. Optional `entries`
 * seed the map (key order preserved); each call produces a fresh `Map`, so two
 * objects built from equal entries are still distinct reference values.
 */
export function makeObject(
  entries?: Iterable<readonly [string, Value]>,
): ObjectValue {
  return { kind: ValueKind.Object, entries: new Map(entries) };
}

/**
 * A user-defined function value closing over `closure`. `name` is the binding
 * name for diagnostics/stack frames, or `null` for an anonymous function literal.
 */
export function makeFunction(
  node: FunctionNode,
  closure: Environment,
  name: string | null,
): FunctionValue {
  return { kind: ValueKind.Function, node, closure, name };
}

/** A builtin (native) function value. */
export function makeBuiltin(
  name: string,
  arity: Arity,
  impl: BuiltinImpl,
): BuiltinValue {
  return { kind: ValueKind.Builtin, name, arity, impl };
}

// ─────────────────────────────────────────────────────────────────────────────
// Truthiness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Klein truthiness: ONLY `null` and `false` are falsy; every other value —
 * including the number `0`, the empty string `""`, and empty arrays/objects — is
 * truthy (see `docs/LANGUAGE.md#truthiness`).
 */
export function isTruthy(value: Value): boolean {
  if (value.kind === ValueKind.Null) {
    return false;
  }
  if (value.kind === ValueKind.Boolean) {
    return value.value;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structural equality (`==` / `!=`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The `==` relation. Primitives (`null`, boolean, number, string) compare by
 * value; number equality is IEEE-754 (so `NaN != NaN` and `0 == -0`). Arrays,
 * objects, functions, and builtins compare by **reference identity** — two
 * distinct-but-structurally-equal arrays are NOT equal. Values of different kinds
 * are never equal (this yields `false`, never a type error). `!=` is the logical
 * negation of this relation and is computed by the evaluator.
 */
export function valuesEqual(a: Value, b: Value): boolean {
  // Different kinds are never equal (no coercion). This also lets each arm below
  // reason about a single kind.
  if (a.kind !== b.kind) {
    return false;
  }
  switch (a.kind) {
    case ValueKind.Null:
      // The only null is `null`; two nulls are equal.
      return true;
    case ValueKind.Boolean:
      return b.kind === ValueKind.Boolean && a.value === b.value;
    case ValueKind.Number:
      // IEEE-754 `===`: NaN is unequal to itself, +0 equals -0.
      return b.kind === ValueKind.Number && a.value === b.value;
    case ValueKind.String:
      return b.kind === ValueKind.String && a.value === b.value;
    case ValueKind.Array:
    case ValueKind.Object:
    case ValueKind.Function:
    case ValueKind.Builtin:
      // Reference identity: same object in memory.
      return a === b;
    default:
      return assertNever(a);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical stringifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a value to its canonical Klein text form — the single source of truth
 * for `print`/REPL/diagnostic output. Strings in value position render raw;
 * see the module header for the nested-quoting and number-formatting contract.
 */
export function stringify(value: Value): string {
  return render(value, false);
}

/**
 * @param quoteStrings when true, a string is rendered as a quoted literal (nested
 * context, so collections are unambiguous); when false, as its raw contents
 * (top-level value position).
 */
function render(value: Value, quoteStrings: boolean): string {
  switch (value.kind) {
    case ValueKind.Null:
      return "null";
    case ValueKind.Boolean:
      return value.value ? "true" : "false";
    case ValueKind.Number:
      return formatNumber(value.value);
    case ValueKind.String:
      return quoteStrings ? quoteString(value.value) : value.value;
    case ValueKind.Array:
      // Elements always render nested (quoted strings) so `[1, "1"]` is unambiguous.
      return `[${value.elements.map((element) => render(element, true)).join(", ")}]`;
    case ValueKind.Object: {
      const parts: string[] = [];
      for (const [key, entry] of value.entries) {
        parts.push(`${key}: ${render(entry, true)}`);
      }
      return parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
    }
    case ValueKind.Function:
      return value.name === null ? "<fn>" : `<fn ${value.name}>`;
    case ValueKind.Builtin:
      return `<builtin ${value.name}>`;
    default:
      return assertNever(value);
  }
}

/**
 * Format a Klein number. Uses JavaScript's shortest round-tripping representation,
 * which prints integral doubles without a trailing `.0` (per
 * `docs/LANGUAGE.md#numbers`) and non-finite doubles as `NaN`/`Infinity`/
 * `-Infinity`.
 */
function formatNumber(value: number): string {
  return String(value);
}

/**
 * Render `raw` as a double-quoted Klein string literal, escaping the characters
 * the lexer recognizes as escapes (`docs/LANGUAGE.md#strings`) plus other C0
 * control characters as `\uXXXX`. The result re-lexes back to `raw`.
 */
function quoteString(raw: string): string {
  let out = '"';
  for (const ch of raw) {
    switch (ch) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\0":
        out += "\\0";
        break;
      default: {
        const code = ch.codePointAt(0) ?? 0;
        // Escape remaining non-printable C0 control characters; pass everything
        // else (including printable Unicode) through verbatim.
        out += code < 0x20 ? `\\u${code.toString(16).padStart(4, "0")}` : ch;
      }
    }
  }
  return `${out}"`;
}

/**
 * Compile-time exhaustiveness guard: if a new `ValueKind` is added to the contract
 * without a corresponding arm above, `value` ceases to be `never` and this fails
 * to type-check. At runtime it defends against a malformed value.
 */
function assertNever(value: never): never {
  throw new Error(
    `unreachable: unhandled ValueKind ${String((value as { kind: unknown }).kind)}`,
  );
}
