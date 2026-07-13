/**
 * CONTRACT — Lexical vocabulary and source-position model for the Klein language.
 *
 * READ-ONLY. This file is the machine-verifiable structural agreement shared by
 * every component in the pipeline (lexer, parser, runtime, stdlib, cli). Do NOT
 * copy these declarations into component source — import them:
 *
 *     import { TokenType, Token, Span } from "../../contracts/tokens";
 *
 * (The scaffold task wires a path alias `@contracts/*` so components import
 * `@contracts/tokens` rather than a brittle relative path; either form resolves
 * to THIS file.)
 *
 * Ownership: authored by the decomposition root. Amendments are additive only
 * (new token kinds may be appended; existing kinds MUST NOT be renamed/removed).
 */

/** A zero-based byte offset paired with 1-based line/column, for diagnostics. */
export interface Position {
  /** 0-based index into the source string. */
  readonly offset: number;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column number (counts UTF-16 code units, matching String.length). */
  readonly column: number;
}

/** A half-open source range [start, end) plus the originating file name. */
export interface Span {
  readonly start: Position;
  readonly end: Position;
  /** Logical source name, e.g. a file path or "<repl>" / "<stdin>". */
  readonly source: string;
}

/**
 * The complete, closed set of token kinds Klein recognizes. Every component
 * agrees on these exact string values; they double as the canonical wire
 * vocabulary. String-valued (not numeric) so diagnostics and snapshots are
 * stable and human-readable.
 */
export enum TokenType {
  // --- Literals ---
  Number = "Number",
  String = "String",
  True = "True",
  False = "False",
  Null = "Null",
  Identifier = "Identifier",

  // --- Keywords ---
  Let = "Let",
  Fn = "Fn",
  Return = "Return",
  If = "If",
  Else = "Else",
  While = "While",
  For = "For",
  Break = "Break",
  Continue = "Continue",

  // --- Punctuation ---
  LParen = "LParen", // (
  RParen = "RParen", // )
  LBrace = "LBrace", // {
  RBrace = "RBrace", // }
  LBracket = "LBracket", // [
  RBracket = "RBracket", // ]
  Comma = "Comma", // ,
  Semicolon = "Semicolon", // ;
  Colon = "Colon", // :
  Dot = "Dot", // .

  // --- Operators ---
  Plus = "Plus", // +
  Minus = "Minus", // -
  Star = "Star", // *
  Slash = "Slash", // /
  Percent = "Percent", // %
  Assign = "Assign", // =
  Eq = "Eq", // ==
  NotEq = "NotEq", // !=
  Lt = "Lt", // <
  Gt = "Gt", // >
  LtEq = "LtEq", // <=
  GtEq = "GtEq", // >=
  Bang = "Bang", // !
  And = "And", // &&
  Or = "Or", // ||

  // --- Control ---
  /** Synthetic terminal token. The lexer MUST emit exactly one, last. */
  EOF = "EOF",
}

/**
 * The canonical keyword table. Locked here so the lexer cannot drift from the
 * parser's expectations. The lexer classifies an identifier lexeme by looking
 * it up here; a miss means TokenType.Identifier.
 */
export const KEYWORDS: Readonly<Record<string, TokenType>> = Object.freeze({
  let: TokenType.Let,
  fn: TokenType.Fn,
  return: TokenType.Return,
  if: TokenType.If,
  else: TokenType.Else,
  while: TokenType.While,
  for: TokenType.For,
  break: TokenType.Break,
  continue: TokenType.Continue,
  true: TokenType.True,
  false: TokenType.False,
  null: TokenType.Null,
});

/**
 * A lexical token. `value` is the pre-decoded literal payload the lexer computes
 * once (number value, or string value with escapes resolved) so downstream
 * stages never re-parse a lexeme. It is present iff `type` is Number or String.
 */
export interface Token {
  readonly type: TokenType;
  /** The exact source text of the token (raw, undecoded). */
  readonly lexeme: string;
  /** Decoded literal payload: number for Number tokens, string for String tokens. */
  readonly value?: number | string;
  readonly span: Span;
}
