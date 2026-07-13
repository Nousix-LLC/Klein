/**
 * The Klein lexer: the first pipeline stage, turning raw source text into the
 * `Token[]` the parser consumes.
 *
 * Design notes (see `docs/LANGUAGE.md` §"Lexical structure" and
 * `contracts/tokens.ts`):
 *
 *  - **Single responsibility: scanning.** It recognizes the closed `TokenType`
 *    vocabulary, decodes literal payloads once (a number's numeric value, a
 *    string's escape-resolved characters), and classifies identifier lexemes
 *    against the canonical `KEYWORDS` table. Nothing here builds AST or evaluates.
 *
 *  - **Error tolerance.** The lexer never throws on malformed input. It records a
 *    structured `LexicalError` (with a stable `ErrorCode`) and keeps scanning, so
 *    a single run surfaces many problems. The recovery policy is uniform:
 *      * a lexeme that cannot form a valid token (`UnexpectedCharacter`,
 *        `UnterminatedString`, `InvalidNumber`) is diagnosed and *no* token is
 *        emitted for it — scanning resumes at the next lexeme boundary;
 *      * a token that is structurally valid but contains a recoverable fault
 *        (`InvalidEscape` inside an otherwise-closed string) is diagnosed and the
 *        token is still emitted, with the bad escape recovered locally.
 *    `UnterminatedComment` concerns trivia, so it never had a token to emit.
 *
 *  - **Precise spans.** Every token and every diagnostic carries a half-open
 *    `[start, end)` span with 0-based offsets and 1-based line/column, where
 *    `column` counts UTF-16 code units to match `String.length` (per the
 *    `Position` contract). Newlines advance the line and reset the column.
 *
 * The stream always ends with exactly one synthetic `EOF` token.
 *
 * The span/position geometry and the concrete `LexicalError` class are imported
 * from `@core` (owned by the scaffold task); the token/error vocabulary is
 * imported literally from `@contracts`. Neither is re-declared here.
 */

import {
  ErrorCode,
  KEYWORDS,
  TokenType,
  type KleinError,
  type LexResult,
  type Lexer as LexerContract,
  type Position,
  type Token,
} from "@contracts";
import { LexicalError, makePosition, makeSpan, pointSpan } from "@core";

import { isAlpha, isAlphaNum, isDigit, isHexDigit } from "./char";

export class Lexer implements LexerContract {
  private readonly source: string;
  private readonly sourceName: string;

  /** 0-based index of the next code unit to read. */
  private offset = 0;
  /** 1-based line of the next code unit. */
  private line = 1;
  /** 1-based column (UTF-16 code units) of the next code unit. */
  private column = 1;

  private readonly tokens: Token[] = [];
  private readonly errors: KleinError[] = [];

  /**
   * @param source     the full Klein source text to tokenize
   * @param sourceName logical origin used in spans (a file path, or
   *                   `"<repl>"` / `"<stdin>"`); defaults to `"<script>"`
   */
  constructor(source: string, sourceName = "<script>") {
    this.source = source;
    this.sourceName = sourceName;
  }

  /**
   * Scan the entire source in one pass. Always returns a stream terminated by a
   * single `EOF` token, plus every lexical error collected along the way.
   */
  tokenize(): LexResult {
    while (true) {
      this.skipTrivia();
      if (this.isAtEnd()) break;
      this.scanToken();
    }
    const end = this.currentPos();
    this.tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      span: pointSpan(end, this.sourceName),
    });
    return { tokens: this.tokens, errors: this.errors };
  }

  // ── Cursor primitives ─────────────────────────────────────────────────────

  private isAtEnd(): boolean {
    return this.offset >= this.source.length;
  }

  /** The next code unit (or `n` ahead) without consuming; `""` past the end. */
  private peek(n = 0): string {
    return this.source.charAt(this.offset + n);
  }

  /** Consume and return the next code unit, advancing line/column bookkeeping. */
  private advance(): string {
    const ch = this.source.charAt(this.offset);
    this.offset++;
    if (ch === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  /** Consume the next code unit iff it equals `expected`; report whether it did. */
  private match(expected: string): boolean {
    if (this.isAtEnd() || this.peek() !== expected) return false;
    this.advance();
    return true;
  }

  /** A snapshot of the cursor as a `Position` (the location of the next read). */
  private currentPos(): Position {
    return makePosition(this.offset, this.line, this.column);
  }

  // ── Trivia: whitespace and comments ───────────────────────────────────────

  private skipTrivia(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
      } else if (ch === "/" && this.peek(1) === "/") {
        // Line comment: consume to end of line, leaving the newline for the
        // whitespace branch (so line bookkeeping stays in one place).
        while (!this.isAtEnd() && this.peek() !== "\n") this.advance();
      } else if (ch === "/" && this.peek(1) === "*") {
        this.scanBlockComment();
      } else {
        return;
      }
    }
  }

  /** Consume a `/* … *\/` block comment. Block comments do not nest. */
  private scanBlockComment(): void {
    const start = this.currentPos();
    this.advance(); // '/'
    this.advance(); // '*'
    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peek(1) === "/") {
        this.advance(); // '*'
        this.advance(); // '/'
        return;
      }
      this.advance();
    }
    this.error(
      ErrorCode.UnterminatedComment,
      "unterminated block comment",
      start,
    );
  }

  // ── Token dispatch ────────────────────────────────────────────────────────

  private scanToken(): void {
    const start = this.currentPos();
    const ch = this.peek();

    // Multi-character lexemes consume from `start` themselves.
    if (ch === '"') {
      this.scanString(start);
      return;
    }
    if (isDigit(ch) || (ch === "." && isDigit(this.peek(1)))) {
      this.scanNumber(start);
      return;
    }
    if (isAlpha(ch)) {
      this.scanIdentifier(start);
      return;
    }

    // Single- and double-character operators / punctuation.
    this.advance();
    switch (ch) {
      case "(":
        this.push(TokenType.LParen, start);
        break;
      case ")":
        this.push(TokenType.RParen, start);
        break;
      case "{":
        this.push(TokenType.LBrace, start);
        break;
      case "}":
        this.push(TokenType.RBrace, start);
        break;
      case "[":
        this.push(TokenType.LBracket, start);
        break;
      case "]":
        this.push(TokenType.RBracket, start);
        break;
      case ",":
        this.push(TokenType.Comma, start);
        break;
      case ";":
        this.push(TokenType.Semicolon, start);
        break;
      case ":":
        this.push(TokenType.Colon, start);
        break;
      case ".":
        this.push(TokenType.Dot, start);
        break;
      case "+":
        this.push(TokenType.Plus, start);
        break;
      case "-":
        this.push(TokenType.Minus, start);
        break;
      case "*":
        this.push(TokenType.Star, start);
        break;
      case "/":
        // Comments were consumed by skipTrivia; a bare '/' is division.
        this.push(TokenType.Slash, start);
        break;
      case "%":
        this.push(TokenType.Percent, start);
        break;
      case "=":
        this.push(this.match("=") ? TokenType.Eq : TokenType.Assign, start);
        break;
      case "!":
        this.push(this.match("=") ? TokenType.NotEq : TokenType.Bang, start);
        break;
      case "<":
        this.push(this.match("=") ? TokenType.LtEq : TokenType.Lt, start);
        break;
      case ">":
        this.push(this.match("=") ? TokenType.GtEq : TokenType.Gt, start);
        break;
      case "&":
        if (this.match("&")) this.push(TokenType.And, start);
        else this.errorUnexpected(start);
        break;
      case "|":
        if (this.match("|")) this.push(TokenType.Or, start);
        else this.errorUnexpected(start);
        break;
      default:
        this.errorUnexpected(start);
        break;
    }
  }

  // ── Identifiers and keywords ──────────────────────────────────────────────

  private scanIdentifier(start: Position): void {
    while (isAlphaNum(this.peek())) this.advance();
    const lexeme = this.source.slice(start.offset, this.offset);
    const type = KEYWORDS[lexeme] ?? TokenType.Identifier;
    this.push(type, start);
  }

  // ── Numbers ───────────────────────────────────────────────────────────────

  /**
   * Scan a numeric literal in one of the three fixed forms — decimal (incl. a
   * leading-dot fraction like `.5`), exponent, or hexadecimal. A structurally
   * malformed literal (`0x` with no digits, an exponent with no digits, or a
   * numeric literal butted directly against identifier characters like `123abc`)
   * is reported as `InvalidNumber` and yields no token.
   */
  private scanNumber(start: Position): void {
    let invalid = false;

    if (this.peek() === "0" && (this.peek(1) === "x" || this.peek(1) === "X")) {
      this.advance(); // '0'
      this.advance(); // 'x' | 'X'
      let hexDigits = 0;
      while (isHexDigit(this.peek())) {
        this.advance();
        hexDigits++;
      }
      if (hexDigits === 0) invalid = true; // "0x" with no hex digits
    } else {
      while (isDigit(this.peek())) this.advance(); // integer part
      if (this.peek() === "." && isDigit(this.peek(1))) {
        this.advance(); // '.'
        while (isDigit(this.peek())) this.advance(); // fraction
      }
      if (this.peek() === "e" || this.peek() === "E") {
        this.advance(); // 'e' | 'E'
        if (this.peek() === "+" || this.peek() === "-") this.advance();
        let expDigits = 0;
        while (isDigit(this.peek())) {
          this.advance();
          expDigits++;
        }
        if (expDigits === 0) invalid = true; // "1e", "1e+"
      }
    }

    // A numeric literal may not run directly into identifier characters.
    if (isAlpha(this.peek())) {
      invalid = true;
      while (isAlphaNum(this.peek())) this.advance();
    }

    const lexeme = this.source.slice(start.offset, this.offset);
    if (invalid) {
      this.error(
        ErrorCode.InvalidNumber,
        `invalid numeric literal '${lexeme}'`,
        start,
      );
      return;
    }
    // `Number` decodes all three literal forms (decimal, exponent, 0x-hex).
    this.pushValue(TokenType.Number, start, Number(lexeme));
  }

  // ── Strings ───────────────────────────────────────────────────────────────

  /**
   * Scan a double-quoted string, decoding escapes into the token's `value`. An
   * unterminated string (no closing quote before newline or end of input) is
   * `UnterminatedString` and yields no token; a bad escape inside an otherwise
   * closed string is `InvalidEscape`, recovered locally so the token still emits.
   */
  private scanString(start: Position): void {
    this.advance(); // opening quote
    let value = "";
    while (true) {
      if (this.isAtEnd() || this.peek() === "\n") {
        this.error(
          ErrorCode.UnterminatedString,
          "unterminated string literal",
          start,
        );
        return;
      }
      const ch = this.peek();
      if (ch === '"') {
        this.advance(); // closing quote
        this.pushValue(TokenType.String, start, value);
        return;
      }
      if (ch === "\\") {
        value += this.scanEscape();
        continue;
      }
      value += this.advance();
    }
  }

  /**
   * Consume one `\`-escape starting at the backslash and return its decoded
   * text. On an unrecognized or malformed escape, records `InvalidEscape` and
   * recovers by taking the offending character(s) literally so scanning of the
   * enclosing string continues.
   */
  private scanEscape(): string {
    const escStart = this.currentPos();
    this.advance(); // backslash
    if (this.isAtEnd() || this.peek() === "\n") {
      // Dangling backslash at end of line/input: the string is unterminated;
      // report the incomplete escape and let scanString observe the newline/EOF.
      this.error(
        ErrorCode.InvalidEscape,
        "incomplete escape sequence",
        escStart,
      );
      return "";
    }
    const e = this.advance();
    switch (e) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      case '"':
        return '"';
      case "0":
        return "\0";
      case "u":
        return this.scanUnicodeEscape(escStart);
      default:
        this.error(
          ErrorCode.InvalidEscape,
          `unknown escape sequence '\\${e}'`,
          escStart,
        );
        return e; // recover: take the escaped character literally
    }
  }

  /**
   * Decode the `XXXX` of a `\uXXXX` escape (the `\u` is already consumed).
   * Requires exactly four hex digits; otherwise `InvalidEscape`, recovered by
   * treating the consumed characters as literal string content.
   */
  private scanUnicodeEscape(escStart: Position): string {
    let hex = "";
    for (let i = 0; i < 4; i++) {
      if (!isHexDigit(this.peek())) break;
      hex += this.advance();
    }
    if (hex.length !== 4) {
      this.error(
        ErrorCode.InvalidEscape,
        "invalid unicode escape (expected \\uXXXX)",
        escStart,
      );
      return "u" + hex; // recover: the '\' is dropped, the rest kept literally
    }
    return String.fromCharCode(parseInt(hex, 16));
  }

  // ── Token / error construction ────────────────────────────────────────────

  /** Emit a token with no decoded payload (everything but Number/String). */
  private push(type: TokenType, start: Position): void {
    this.tokens.push({
      type,
      lexeme: this.source.slice(start.offset, this.offset),
      span: makeSpan(start, this.currentPos(), this.sourceName),
    });
  }

  /** Emit a Number/String token carrying its pre-decoded `value`. */
  private pushValue(
    type: TokenType,
    start: Position,
    value: number | string,
  ): void {
    this.tokens.push({
      type,
      lexeme: this.source.slice(start.offset, this.offset),
      value,
      span: makeSpan(start, this.currentPos(), this.sourceName),
    });
  }

  /** Record a lexical error spanning `[start, currentPos)`. */
  private error(code: ErrorCode, message: string, start: Position): void {
    this.errors.push(
      new LexicalError(
        code,
        message,
        makeSpan(start, this.currentPos(), this.sourceName),
      ),
    );
  }

  /** Record `UnexpectedCharacter` for the just-consumed lexeme. */
  private errorUnexpected(start: Position): void {
    const lexeme = this.source.slice(start.offset, this.offset);
    this.error(
      ErrorCode.UnexpectedCharacter,
      `unexpected character '${lexeme}'`,
      start,
    );
  }
}
