/**
 * Tests for the registry: `defaultBuiltins`.
 *
 * These verify the roster's structural invariants (every entry is a well-formed
 * `BuiltinValue`, names are unique, the fresh-array contract holds) and that the
 * exact documented roster is installed — so an accidental drop or duplicate fails
 * loudly.
 */

import { describe, expect, it } from "vitest";

import { ValueKind } from "@contracts";

import { Interpreter } from "../../src/runtime";
import { defaultBuiltins } from "../../src/stdlib";

/** The full roster the stdlib is expected to install, in category order. */
const EXPECTED_NAMES = [
  // I/O
  "print",
  "println",
  // inspection
  "len",
  "type",
  "keys",
  "values",
  "has",
  "contains",
  // conversions
  "str",
  "num",
  "int",
  "bool",
  "chars",
  "ord",
  "chr",
  // collections
  "push",
  "pop",
  "slice",
  "range",
  "map",
  "filter",
  "reduce",
  "sort",
  "join",
  "split",
  // strings
  "upper",
  "lower",
  "trim",
  // math
  "abs",
  "floor",
  "ceil",
  "round",
  "sqrt",
  "min",
  "max",
  "pow",
  // diagnostics
  "assert",
  "error",
  "clock",
];

describe("defaultBuiltins", () => {
  it("installs exactly the documented roster, in order", () => {
    const names = defaultBuiltins().map((builtin) => builtin.name);
    expect(names).toEqual(EXPECTED_NAMES);
  });

  it("contains only well-formed builtin values with declared arities", () => {
    for (const builtin of defaultBuiltins()) {
      expect(builtin.kind).toBe(ValueKind.Builtin);
      expect(typeof builtin.name).toBe("string");
      expect(typeof builtin.impl).toBe("function");
      expect(builtin.arity.min).toBeGreaterThanOrEqual(0);
      if (builtin.arity.max !== null) {
        expect(builtin.arity.max).toBeGreaterThanOrEqual(builtin.arity.min);
      }
    }
  });

  it("has no duplicate names", () => {
    const names = defaultBuiltins().map((builtin) => builtin.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("returns a fresh array each call, sharing the immutable builtin instances", () => {
    const first = defaultBuiltins();
    const second = defaultBuiltins();
    expect(first).not.toBe(second); // distinct arrays
    expect(first[0]).toBe(second[0]); // same shared instances
  });

  it("installs every builtin into a fresh interpreter's global scope", () => {
    const interpreter = new Interpreter({ builtins: defaultBuiltins() });
    for (const name of EXPECTED_NAMES) {
      expect(interpreter.globals.has(name)).toBe(true);
    }
  });
});
