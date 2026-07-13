/**
 * Shared helpers for the parser test-suite.
 *
 * Per the parser brief, tests drive the **real** lexer (`src/lexer`) so the parser
 * is exercised end-to-end on real source text and a real token stream — never a
 * hand-mocked one. These helpers lex-then-parse and offer small, well-typed
 * extractors so individual tests stay focused on the AST shape under test.
 *
 * This file has no `*.test.ts` suffix, so Vitest does not collect it as a suite;
 * it lives under `tests/` (outside `src/`) so it is excluded from coverage.
 */

import { expect } from "vitest";

import type { ErrorCode, Expression, ParseResult, Statement } from "@contracts";
import { Lexer } from "../../src/lexer";
import { Parser } from "../../src/parser";

/** Lex `src` with the real lexer, then parse the resulting token stream. */
export function parse(src: string, name = "test.kl"): ParseResult {
  const { tokens } = new Lexer(src, name).tokenize();
  return new Parser(tokens, name).parse();
}

/** The stable `ErrorCode`s the parser reported for `src`, in source order. */
export function errorCodes(src: string): ErrorCode[] {
  return parse(src).errors.map((e) => e.code);
}

/** Parse `src`, asserting it produced no syntax errors, and return its statements. */
export function parseStatements(src: string): readonly Statement[] {
  const { program, errors } = parse(src);
  expect(errors.map((e) => e.code)).toEqual([]);
  return program.body;
}

/** Parse exactly one statement from `src` (asserting there is exactly one). */
export function parseStatement(src: string): Statement {
  const body = parseStatements(src);
  expect(body).toHaveLength(1);
  // `body[0]` is present: the length assertion above guarantees it.
  return body[0] as Statement;
}

/**
 * Parse a single Klein **expression** (given without a trailing `;`) and return
 * its AST, asserting it parsed cleanly.
 *
 * The expression is placed in a `let` initializer — an unambiguous *expression*
 * position — rather than as a bare expression statement, because at statement
 * position a leading `{` is a block and a leading `fn` is a declaration (per the
 * grammar). The initializer position lets this helper handle every expression
 * form, object and function literals included.
 */
export function parseExpression(src: string): Expression {
  const stmt = parseStatement(`let __expr__ = ${src};`);
  expect(stmt.kind).toBe("LetStatement");
  if (stmt.kind !== "LetStatement") throw new Error("unreachable");
  return stmt.value;
}
