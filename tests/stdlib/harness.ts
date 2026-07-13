/**
 * Shared harness for the stdlib test-suite.
 *
 * Every builtin is exercised **end-to-end through the real pipeline** — real
 * lexer, real parser, real interpreter — with the full {@link defaultBuiltins}
 * roster installed, exactly as the CLI runs a program. This is deliberate: it is
 * the only way to test the higher-order builtins (`map`/`filter`/`reduce`/`sort`)
 * against genuine user closures invoked through the interpreter's own
 * `BuiltinContext.call`, and it proves the interpreter's arity/type enforcement
 * composes with each builtin.
 *
 * `write` is redirected into a buffer so `print`/`println` output is observable.
 * Assertions key off the canonical value stringifier and structured `ErrorCode`s,
 * never off human-readable message text (per the project quality bar).
 *
 * This file has no `*.test.ts` suffix, so Vitest does not collect it as a suite;
 * it lives under `tests/` (outside `src/`) so it is excluded from coverage.
 */

import { expect } from "vitest";

import { type ErrorCode, type Value } from "@contracts";
import { RuntimeErr } from "@core";

import { Lexer } from "../../src/lexer";
import { Parser } from "../../src/parser";
import { Interpreter, stringify } from "../../src/runtime";
import { defaultBuiltins } from "../../src/stdlib";

const SOURCE = "test.kl";

/** The result of running a Klein program: its value plus everything it printed. */
export interface RunResult {
  readonly value: Value;
  readonly output: string;
}

/** Lex + parse + run `src` with the full stdlib, asserting it is lex/parse-clean. */
export function runKlein(src: string): RunResult {
  const { tokens, errors: lexErrors } = new Lexer(src, SOURCE).tokenize();
  expect(lexErrors.map((error) => error.code)).toEqual([]);
  const { program, errors: parseErrors } = new Parser(tokens, SOURCE).parse();
  expect(parseErrors.map((error) => error.code)).toEqual([]);

  let output = "";
  const interpreter = new Interpreter({
    write: (text) => {
      output += text;
    },
    builtins: defaultBuiltins(),
  });
  return { value: interpreter.run(program), output };
}

/** Run `src` and return the canonical string form of its result value. */
export function evalKlein(src: string): string {
  return stringify(runKlein(src).value);
}

/** Run `src` and return only what it wrote to the output sink. */
export function outputOf(src: string): string {
  return runKlein(src).output;
}

/**
 * Run `src`, asserting it throws a {@link RuntimeErr} whose `code` is `code`
 * (message text is never asserted). Returns the error for further inspection.
 */
export function expectErrorCode(src: string, code: ErrorCode): RuntimeErr {
  let caught: unknown;
  try {
    runKlein(src);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuntimeErr);
  const error = caught as RuntimeErr;
  expect(error.code).toBe(code);
  return error;
}
