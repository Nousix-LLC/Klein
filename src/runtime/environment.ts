/**
 * The Klein lexical scope chain — the runtime's binding/lookup substrate.
 *
 * A tree-walking interpreter needs exactly one thing from its scoping model:
 * given a name, find the innermost binding for it, honoring block and closure
 * nesting. {@link Environment} is that model and nothing more. It is a small,
 * total, well-typed data structure:
 *
 *  - **Single responsibility: lexical binding + lookup.** It stores name→value
 *    bindings for ONE scope and links to its enclosing scope via {@link parent}.
 *    It does not evaluate, does not construct {@link Value}s, and does not know
 *    about call depth or stack overflow — those belong to the evaluator, which
 *    composes this class to build block, function, and closure scopes.
 *
 *  - **Shadowing falls out of the chain.** {@link define} always writes into
 *    *this* scope, so an inner `let x` transparently shadows an outer `x`;
 *    {@link get}/{@link assign}/{@link has} search from this scope outward and
 *    stop at the first (innermost) hit.
 *
 *  - **Misses are structured, span-anchored faults.** {@link get} and
 *    {@link assign} throw a {@link RuntimeErr} carrying
 *    {@link ErrorCode.UndefinedVariable} and the caller-supplied {@link Span}, so
 *    every unbound-name fault reduces to a source-anchored diagnostic like every
 *    other Klein runtime error. No bare JS `Error` ever escapes.
 *
 * The `Environment` *interface* is fixed by the read-only `contracts/values.ts`
 * and imported literally; `RuntimeErr` (the concrete error class) comes from
 * `@core`. Neither is re-declared here.
 */

import {
  ErrorCode,
  type Environment as EnvironmentContract,
  type Span,
  type Value,
} from "@contracts";
import { RuntimeErr } from "@core";

/**
 * A single lexical scope in the chain: a `Map` of local bindings plus a link to
 * the enclosing scope (`null` at the global scope). Realizes the contract
 * {@link EnvironmentContract} exactly.
 *
 * A `Map<string, Value>` (not a plain object) backs the bindings so lookups
 * never collide with `Object.prototype` members (`__proto__`, `toString`, …) and
 * so the model is immune to prototype pollution — the same rationale the value
 * model uses a `Map` for Klein objects.
 */
export class Environment implements EnvironmentContract {
  /** The enclosing scope, or `null` for the global (outermost) scope. */
  readonly parent: Environment | null;

  /** Bindings declared directly in THIS scope. */
  private readonly bindings: Map<string, Value>;

  /**
   * Create a scope nested inside `parent` (default `null` → the global scope).
   * Prefer {@link child} to derive a nested scope from an existing one; the
   * public constructor is for creating the root scope.
   */
  constructor(parent: Environment | null = null) {
    this.parent = parent;
    this.bindings = new Map<string, Value>();
  }

  /**
   * Bind `name` to `value` in THIS scope, shadowing any binding of the same name
   * in an enclosing scope. Re-defining a name already bound in this same scope
   * overwrites it (last `let`/param wins).
   */
  define(name: string, value: Value): void {
    this.bindings.set(name, value);
  }

  /**
   * Resolve `name`, searching this scope then outward through {@link parent}.
   * Returns the value of the innermost binding.
   *
   * @throws RuntimeErr `UndefinedVariable`, anchored at `span`, when `name` is
   * bound nowhere in the chain.
   */
  get(name: string, span: Span): Value {
    // A `Value` is never `undefined` (the union has a `null` member, not the JS
    // `undefined`), so a non-`undefined` result unambiguously means the key is
    // present in THIS scope — no separate `.has()` probe is needed.
    const found = this.bindings.get(name);
    if (found !== undefined) {
      return found;
    }
    if (this.parent !== null) {
      // Recurse outward; the caller's `span` is threaded through unchanged so the
      // fault (thrown at the root on a total miss) stays anchored to the use site.
      return this.parent.get(name, span);
    }
    throw new RuntimeErr(
      ErrorCode.UndefinedVariable,
      `undefined variable '${name}'`,
      span,
    );
  }

  /**
   * Assign `value` to the NEAREST existing binding of `name`, searching this
   * scope then outward. Mutates that binding in place (so the update is visible
   * to any inner scope that resolves `name` afterward); it never creates a new
   * binding.
   *
   * @throws RuntimeErr `UndefinedVariable`, anchored at `span`, when `name` is
   * bound nowhere in the chain (assignment to an undeclared name is an error, not
   * an implicit declaration).
   */
  assign(name: string, value: Value, span: Span): void {
    if (this.bindings.has(name)) {
      this.bindings.set(name, value);
      return;
    }
    if (this.parent !== null) {
      this.parent.assign(name, value, span);
      return;
    }
    throw new RuntimeErr(
      ErrorCode.UndefinedVariable,
      `undefined variable '${name}'`,
      span,
    );
  }

  /** True iff `name` is bound in this scope or any enclosing scope. */
  has(name: string): boolean {
    if (this.bindings.has(name)) {
      return true;
    }
    return this.parent !== null && this.parent.has(name);
  }

  /** Create a fresh nested scope whose {@link parent} is this environment. */
  child(): Environment {
    return new Environment(this);
  }
}
