/**
 * `src/runtime` public barrel — the runtime subtree of the Klein pipeline
 * (AST → `Value`). Downstream stages (`stdlib`, `cli`) import the whole runtime
 * surface from one place:
 *
 *     import { Interpreter, Environment, makeNumber, stringify } from "../runtime";
 *
 * It re-exports the three runtime modules' public surfaces and nothing else:
 *   - the value model              (./values): constructors, singletons, the
 *                                   truthiness rule, structural equality, and the
 *                                   canonical stringifier.
 *   - the lexical scope chain      (./environment): the concrete `Environment`.
 *   - the tree-walking evaluator   (./interpreter): the concrete `Interpreter`.
 *
 * The shared *contract types* (`Value`, `Environment` interface, `Interpreter`
 * interface, `InterpreterOptions`, …) are intentionally NOT re-exported here: they
 * live in `contracts/` and downstream code imports them literally from
 * `@contracts`, keeping one source of truth for the vocabulary and this barrel for
 * the behavior that implements it.
 *
 * This file is a pure re-export barrel (no logic) and is excluded from coverage
 * per `vitest.config.ts`.
 */

// --- Value model: constructors, singletons, truthiness, equality, stringifier ---
export * from "./values";

// --- Lexical scope chain (concrete class; re-exports both value and type) ---
export { Environment } from "./environment";

// --- Tree-walking evaluator (concrete class; re-exports both value and type) ---
export { Interpreter } from "./interpreter";
