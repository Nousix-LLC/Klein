/**
 * CONTRACT barrel. Re-exports the entire compositional schema so consumers can:
 *     import { Token, Program, Value, KleinError } from "@contracts";
 * (Path alias `@contracts` → this file, wired by scaffold in tsconfig.json.)
 *
 * READ-ONLY.
 */
export * from "./tokens";
export * from "./ast";
export * from "./values";
export * from "./errors";
export * from "./pipeline";
