/**
 * Unit tests for the {@link Environment} lexical scope chain.
 *
 * `Environment` is a pure data structure over names, {@link Value}s, and
 * {@link Span}s — it neither lexes nor parses — so these tests construct their
 * inputs directly rather than driving the lexer/parser (the "use the real
 * lexer+parser" convention targets token/AST-shaped inputs, which this module has
 * none of). Values are built as minimal contract-shaped literals: `Environment`
 * treats every {@link Value} opaquely (it only ever stores and returns them), so a
 * bare `{ kind, value }` record is a faithful stand-in and keeps this suite
 * independent of the sibling `runtime.values` task. Spans are built with the real
 * `@core` span helpers (owned by scaffold).
 *
 * Coverage targets every method and both outcomes of each search (hit in this
 * scope, hit in an enclosing scope, and — for `get`/`assign` — the miss that
 * throws), plus shadowing, in-place outer mutation, and `child()` linkage.
 */

import { describe, expect, it } from "vitest";

import { ErrorCode, ValueKind, type Span, type Value } from "@contracts";
import { RuntimeErr, makePosition, makeSpan } from "@core";

import { Environment } from "../../src/runtime/environment";

const SOURCE = "test.kl";

/** A single-line half-open span `[start, end)` in {@link SOURCE}, for miss sites. */
const span = (start: number, end: number): Span =>
  makeSpan(
    makePosition(start, 1, start + 1),
    makePosition(end, 1, end + 1),
    SOURCE,
  );

// Minimal contract-shaped values. `Environment` never inspects a value's
// internals, so these opaque literals fully exercise its storage behavior.
const num = (n: number): Value => ({ kind: ValueKind.Number, value: n });
const str = (s: string): Value => ({ kind: ValueKind.String, value: s });
const NULL: Value = { kind: ValueKind.Null };

/**
 * Assert that `run()` throws a {@link RuntimeErr} carrying `UndefinedVariable`
 * and the EXACT `span` it was given (by reference — proving the caller's span is
 * threaded through unchanged, not re-derived), and that the thrown value is a
 * real `RuntimeErr`/`Error` instance.
 */
function expectUndefinedVariable(run: () => void, at: Span): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuntimeErr);
  expect(caught).toBeInstanceOf(Error);
  const err = caught as RuntimeErr;
  expect(err.code).toBe(ErrorCode.UndefinedVariable);
  expect(err.span).toBe(at);
}

describe("Environment.define / get", () => {
  it("resolves a name bound in the same scope", () => {
    const env = new Environment();
    env.define("x", num(1));
    expect(env.get("x", span(0, 1))).toEqual(num(1));
  });

  it("returns the exact stored value by reference", () => {
    const env = new Environment();
    const value = num(42);
    env.define("answer", value);
    expect(env.get("answer", span(0, 6))).toBe(value);
  });

  it("re-defining a name in the same scope overwrites it", () => {
    const env = new Environment();
    env.define("x", num(1));
    env.define("x", num(2));
    expect(env.get("x", span(0, 1))).toEqual(num(2));
  });

  it("resolves a name bound in an enclosing scope", () => {
    const global = new Environment();
    global.define("g", str("outer"));
    const inner = global.child().child();
    expect(inner.get("g", span(0, 1))).toEqual(str("outer"));
  });

  it("stores null bindings and resolves them (null is a value, not absence)", () => {
    const env = new Environment();
    env.define("n", NULL);
    expect(env.get("n", span(0, 1))).toEqual(NULL);
    expect(env.has("n")).toBe(true);
  });

  it("throws UndefinedVariable, anchored at the given span, on a miss", () => {
    const env = new Environment();
    const at = span(4, 7);
    expectUndefinedVariable(() => env.get("missing", at), at);
  });

  it("throws when the chain is searched to the root without a hit", () => {
    const inner = new Environment().child().child();
    const at = span(2, 5);
    expectUndefinedVariable(() => inner.get("nope", at), at);
  });
});

describe("Environment shadowing", () => {
  it("an inner binding shadows an outer one of the same name", () => {
    const global = new Environment();
    global.define("x", num(1));
    const inner = global.child();
    inner.define("x", num(2));

    expect(inner.get("x", span(0, 1))).toEqual(num(2));
    // The outer binding is untouched by the inner shadow.
    expect(global.get("x", span(0, 1))).toEqual(num(1));
  });
});

describe("Environment.assign", () => {
  it("assigns to a binding in the same scope", () => {
    const env = new Environment();
    env.define("x", num(1));
    env.assign("x", num(9), span(0, 1));
    expect(env.get("x", span(0, 1))).toEqual(num(9));
  });

  it("assigns to the nearest enclosing binding, and the mutation is visible to an inner get", () => {
    const global = new Environment();
    global.define("count", num(0));
    const inner = global.child();

    inner.assign("count", num(5), span(0, 5));

    // Mutated in place on the OUTER scope: both the outer and the inner (which
    // resolves outward) observe the new value; no new inner binding was created.
    expect(global.get("count", span(0, 5))).toEqual(num(5));
    expect(inner.get("count", span(0, 5))).toEqual(num(5));
    expect(Object.prototype.hasOwnProperty.call(inner, "count")).toBe(false);
  });

  it("assigns to the nearest binding when a name is shadowed, not an outer one", () => {
    const global = new Environment();
    global.define("x", num(1));
    const inner = global.child();
    inner.define("x", num(2));

    inner.assign("x", num(3), span(0, 1));

    expect(inner.get("x", span(0, 1))).toEqual(num(3));
    // The shadowed outer binding is left alone.
    expect(global.get("x", span(0, 1))).toEqual(num(1));
  });

  it("throws UndefinedVariable (never implicitly declares) when the name is unbound", () => {
    const env = new Environment();
    const at = span(0, 3);
    expectUndefinedVariable(() => env.assign("x", num(1), at), at);
    // The failed assignment created nothing.
    expect(env.has("x")).toBe(false);
  });

  it("throws from an inner scope when the name is bound nowhere in the chain", () => {
    const inner = new Environment().child();
    const at = span(1, 2);
    expectUndefinedVariable(() => inner.assign("y", num(1), at), at);
  });
});

describe("Environment.has", () => {
  it("is true for a name bound in this scope", () => {
    const env = new Environment();
    env.define("x", num(1));
    expect(env.has("x")).toBe(true);
  });

  it("is true for a name bound in an enclosing scope", () => {
    const global = new Environment();
    global.define("g", num(1));
    expect(global.child().child().has("g")).toBe(true);
  });

  it("is false for a name bound nowhere in the chain", () => {
    const env = new Environment().child();
    expect(env.has("absent")).toBe(false);
  });
});

describe("Environment.child", () => {
  it("links the child's parent to the environment it was created from", () => {
    const global = new Environment();
    const child = global.child();
    expect(child.parent).toBe(global);
  });

  it("gives the global (root) scope a null parent", () => {
    expect(new Environment().parent).toBeNull();
  });

  it("produces a fresh, independent scope each call", () => {
    const global = new Environment();
    const a = global.child();
    const b = global.child();
    expect(a).not.toBe(b);

    a.define("only_in_a", num(1));
    expect(b.has("only_in_a")).toBe(false);
    // A binding in the child does not leak up into the parent.
    expect(global.has("only_in_a")).toBe(false);
  });
});
