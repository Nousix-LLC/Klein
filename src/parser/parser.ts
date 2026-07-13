/**
 * The Klein parser: the second pipeline stage, turning the lexer's `Token[]` into
 * the `Program` AST the runtime evaluates.
 *
 * Design notes (see `docs/GRAMMAR.md` and `contracts/ast.ts`):
 *
 *  - **Single responsibility: parsing.** It consumes a token stream and produces
 *    contract-exact AST nodes. It builds no tokens (that is the lexer) and
 *    evaluates nothing (that is the runtime). Every node it emits is one of the
 *    `contracts/ast.ts` shapes, discriminated by `kind` and carrying an accurate
 *    half-open `span`.
 *
 *  - **Pratt / precedence-climbing expressions.** Binary and logical operators are
 *    parsed by a single climbing loop driven by the declarative table in
 *    `./precedence`, rather than one method per level. Assignment (right-assoc,
 *    binds loosest), prefix unary, and the postfix call/index/member band are
 *    handled by dedicated methods around that loop. The result is the exact
 *    precedence and associativity fixed by `docs/LANGUAGE.md`.
 *
 *  - **Error tolerance.** Like the lexer, the parser never throws to its caller
 *    for a *syntax* fault. On an unexpected token it records a `SyntaxErr` (with a
 *    stable `ErrorCode`) and **synchronizes** — discarding tokens to the next
 *    statement boundary — so one `parse()` surfaces many independent errors. A
 *    partial `program` is always returned. Two faults recover *locally* without
 *    discarding a statement: an invalid assignment target and a duplicate
 *    parameter are diagnosed in place and parsing continues.
 *
 *  - **Precise spans.** Every node's span runs from the first token of the
 *    construct to the last, merged from child spans where a construct is built
 *    from sub-expressions. Parentheses group but build no node (per the grammar),
 *    so a parenthesized expression keeps its inner span.
 *
 * The span geometry helpers and the concrete `SyntaxErr` class are imported from
 * `@core` (owned by scaffold); the token/AST/error vocabulary is imported
 * literally from `@contracts`. Neither is re-declared here.
 */

import {
  ErrorCode,
  TokenType,
  type ArrayLiteral,
  type AssignmentTarget,
  type BinaryOperator,
  type BlockStatement,
  type BreakStatement,
  type CallExpression,
  type ContinueStatement,
  type Expression,
  type ExpressionStatement,
  type ForStatement,
  type FunctionDeclaration,
  type FunctionLiteral,
  type IfStatement,
  type IndexExpression,
  type KleinError,
  type LetStatement,
  type LogicalOperator,
  type MemberExpression,
  type ObjectEntry,
  type ObjectLiteral,
  type Parameter,
  type Parser as ParserContract,
  type ParseResult,
  type Program,
  type ReturnStatement,
  type Span,
  type Statement,
  type Token,
  type UnaryExpression,
  type UnaryOperator,
  type WhileStatement,
} from "@contracts";
import { makeSpan, mergeSpans, SyntaxErr } from "@core";

import { INFIX_OPERATORS, LOWEST_INFIX_PRECEDENCE } from "./precedence";

/**
 * Internal control-flow signal thrown when a hard syntax error is detected. It
 * unwinds parsing up to the nearest statement boundary, where it is caught and
 * {@link Parser.synchronize} resumes scanning. It never escapes `parse()`; it is
 * not a Klein error object (the `SyntaxErr` diagnostic was already recorded before
 * this was thrown). Kept private so no caller can depend on it.
 */
class ParseErrorSignal extends Error {
  constructor() {
    super("parse error (internal recovery signal)");
    this.name = "ParseErrorSignal";
  }
}

/** The token kinds that begin a fresh statement — synchronization stops at these. */
const STATEMENT_START: ReadonlySet<TokenType> = new Set([
  TokenType.Let,
  TokenType.Fn,
  TokenType.If,
  TokenType.While,
  TokenType.For,
  TokenType.Return,
  TokenType.Break,
  TokenType.Continue,
]);

export class Parser implements ParserContract {
  private readonly tokens: readonly Token[];
  private readonly sourceName: string;

  /** Index of the next token to consume. */
  private pos = 0;

  /** Syntax diagnostics collected across the whole pass (source order). */
  private readonly errors: KleinError[] = [];

  /**
   * @param tokens     the full token stream from the lexer (must end with EOF)
   * @param sourceName logical origin used in spans (a file path, or
   *                   `"<repl>"` / `"<stdin>"`); defaults to `"<script>"`
   */
  constructor(tokens: readonly Token[], sourceName = "<script>") {
    this.tokens = tokens;
    this.sourceName = sourceName;
  }

  /**
   * Parse the entire token stream in one pass. Always returns a `program` (partial
   * when `errors` is non-empty) plus every syntax error collected via recovery.
   */
  parse(): ParseResult {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      const before = this.pos;
      try {
        body.push(this.parseStatement());
      } catch (error) {
        if (error instanceof ParseErrorSignal) {
          this.synchronize();
        } else {
          throw error;
        }
      }
      // Guaranteed progress: if an error left the cursor exactly where it was
      // (e.g. a stray `}` that `synchronize` stops *before* but no statement can
      // consume at top level), discard one token so the loop cannot spin.
      if (this.pos === before && !this.isAtEnd()) this.advance();
    }
    const program: Program = {
      kind: "Program",
      body,
      span: makeSpan(
        this.at(0).span.start,
        this.peek().span.end,
        this.sourceName,
      ),
    };
    return { program, errors: this.errors };
  }

  // ── Token cursor primitives ────────────────────────────────────────────────

  /** The token at absolute index `i`. Throws only on the unreachable OOB case. */
  private at(i: number): Token {
    const token = this.tokens[i];
    if (token === undefined) {
      // Unreachable: the lexer guarantees a trailing EOF and the parser never
      // advances past it, so every index the parser forms is in range.
      throw new Error("parser read past end of token stream");
    }
    return token;
  }

  /** The next unconsumed token (the EOF token once the stream is exhausted). */
  private peek(): Token {
    return this.at(this.pos);
  }

  /** The most recently consumed token. */
  private previous(): Token {
    return this.at(this.pos - 1);
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  /** True iff the next token is of kind `type` (never advances). */
  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  /** Consume and return the next token, never advancing past EOF. */
  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  /** Consume the next token iff it is of kind `type`; report whether it was. */
  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  /**
   * Require the next token to be `type`: consume and return it, or record
   * `ExpectedToken` at the offending token and throw the recovery signal.
   */
  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.fail(ErrorCode.ExpectedToken, message, this.peek().span);
  }

  // ── Error handling ─────────────────────────────────────────────────────────

  /** Record a syntax diagnostic (no throw); used for locally-recoverable faults. */
  private record(code: ErrorCode, message: string, span: Span): void {
    this.errors.push(new SyntaxErr(code, message, span));
  }

  /**
   * Record a syntax diagnostic and return the recovery signal to throw. Callers
   * `throw this.fail(...)` so control unwinds to the nearest statement boundary.
   */
  private fail(code: ErrorCode, message: string, span: Span): ParseErrorSignal {
    this.record(code, message, span);
    return new ParseErrorSignal();
  }

  /**
   * Discard tokens until the start of the next statement, so parsing can resume
   * after a hard error. Stops right after a `;` (which ends a statement) or just
   * before a statement-starting keyword or a closing `}` (which ends a block).
   * Always makes progress: any other token — including the one that triggered the
   * error — is consumed, so this cannot spin.
   */
  private synchronize(): void {
    while (!this.isAtEnd()) {
      if (this.pos > 0 && this.previous().type === TokenType.Semicolon) return;
      const next = this.peek().type;
      if (next === TokenType.RBrace || STATEMENT_START.has(next)) return;
      this.advance();
    }
  }

  // ── Statements ─────────────────────────────────────────────────────────────

  private parseStatement(): Statement {
    // A leading keyword (or `{`) selects a statement form; anything else is an
    // expression statement. An `if`/`else` chain rather than a `switch`, since we
    // dispatch only a handful of the `TokenType` union and fall through for the
    // rest (an exhaustive `switch` is reserved for total case analysis).
    const type = this.peek().type;
    if (type === TokenType.Let) return this.parseLetStatement(true);
    if (type === TokenType.Fn) return this.parseFunctionDeclaration();
    if (type === TokenType.If) return this.parseIfStatement();
    if (type === TokenType.While) return this.parseWhileStatement();
    if (type === TokenType.For) return this.parseForStatement();
    if (type === TokenType.Return) return this.parseReturnStatement();
    if (type === TokenType.Break) return this.parseBreakStatement();
    if (type === TokenType.Continue) return this.parseContinueStatement();
    if (type === TokenType.LBrace) return this.parseBlockStatement();
    return this.parseExpressionStatement();
  }

  /**
   * `let IDENT = Expression ( ";" )`. `consumeSemicolon` is false only for a `for`
   * header init clause, whose terminator is the header `;`, not part of the `let`.
   */
  private parseLetStatement(consumeSemicolon: boolean): LetStatement {
    const start = this.advance(); // `let`
    const name = this.expect(
      TokenType.Identifier,
      "expected a variable name after 'let'",
    );
    this.expect(
      TokenType.Assign,
      "expected '=' in let binding (a 'let' must have an initializer)",
    );
    const value = this.parseExpression();
    if (consumeSemicolon) {
      this.expect(TokenType.Semicolon, "expected ';' after let binding");
    }
    return {
      kind: "LetStatement",
      name: name.lexeme,
      nameSpan: name.span,
      value,
      span: this.spanFrom(start),
    };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const start = this.advance(); // `fn`
    const name = this.expect(
      TokenType.Identifier,
      "expected a function name after 'fn'",
    );
    const params = this.parseParameterList();
    const body = this.parseBlockStatement();
    return {
      kind: "FunctionDeclaration",
      name: name.lexeme,
      nameSpan: name.span,
      params,
      body,
      span: this.spanFrom(start),
    };
  }

  /**
   * `"(" [ IDENT { "," IDENT } ] ")"`. Shared by function declarations and
   * function literals. A repeated parameter name is `DuplicateParameter`, recorded
   * in place (the offending name is dropped from the list) so parsing continues.
   */
  private parseParameterList(): Parameter[] {
    this.expect(TokenType.LParen, "expected '(' before parameter list");
    const params: Parameter[] = [];
    const seen = new Set<string>();
    if (!this.check(TokenType.RParen)) {
      do {
        const name = this.expect(
          TokenType.Identifier,
          "expected a parameter name",
        );
        if (seen.has(name.lexeme)) {
          this.record(
            ErrorCode.DuplicateParameter,
            `duplicate parameter '${name.lexeme}'`,
            name.span,
          );
          continue;
        }
        seen.add(name.lexeme);
        params.push({ name: name.lexeme, span: name.span });
      } while (this.match(TokenType.Comma));
    }
    this.expect(TokenType.RParen, "expected ')' after parameter list");
    return params;
  }

  private parseIfStatement(): IfStatement {
    const start = this.advance(); // `if`
    this.expect(TokenType.LParen, "expected '(' after 'if'");
    const condition = this.parseExpression();
    this.expect(TokenType.RParen, "expected ')' after if condition");
    const consequent = this.parseBlockStatement();

    let alternate: BlockStatement | IfStatement | null = null;
    if (this.match(TokenType.Else)) {
      // `else if` is not a separate construct: an `else` followed by `if` yields an
      // alternate that is itself an IfStatement (per contracts/ast.ts).
      alternate = this.check(TokenType.If)
        ? this.parseIfStatement()
        : this.parseBlockStatement();
    }
    return {
      kind: "IfStatement",
      condition,
      consequent,
      alternate,
      span: this.spanFrom(start),
    };
  }

  private parseWhileStatement(): WhileStatement {
    const start = this.advance(); // `while`
    this.expect(TokenType.LParen, "expected '(' after 'while'");
    const condition = this.parseExpression();
    this.expect(TokenType.RParen, "expected ')' after while condition");
    const body = this.parseBlockStatement();
    return {
      kind: "WhileStatement",
      condition,
      body,
      span: this.spanFrom(start),
    };
  }

  /**
   * C-style `for ( [init] ";" [condition] ";" [update] ) block`. All three clauses
   * are optional; the two header `;` are the separators, so the init clause is
   * written without its own trailing `;`.
   */
  private parseForStatement(): ForStatement {
    const start = this.advance(); // `for`
    this.expect(TokenType.LParen, "expected '(' after 'for'");

    let init: LetStatement | ExpressionStatement | null = null;
    if (this.match(TokenType.Semicolon)) {
      init = null;
    } else {
      if (this.check(TokenType.Let)) {
        init = this.parseLetStatement(false);
      } else {
        const expr = this.parseExpression();
        init = {
          kind: "ExpressionStatement",
          expression: expr,
          span: expr.span,
        };
      }
      this.expect(
        TokenType.Semicolon,
        "expected ';' after for-loop initializer",
      );
    }

    const condition = this.check(TokenType.Semicolon)
      ? null
      : this.parseExpression();
    this.expect(TokenType.Semicolon, "expected ';' after for-loop condition");

    const update = this.check(TokenType.RParen) ? null : this.parseExpression();
    this.expect(TokenType.RParen, "expected ')' after for-loop clauses");

    const body = this.parseBlockStatement();
    return {
      kind: "ForStatement",
      init,
      condition,
      update,
      body,
      span: this.spanFrom(start),
    };
  }

  private parseReturnStatement(): ReturnStatement {
    const start = this.advance(); // `return`
    const value = this.check(TokenType.Semicolon)
      ? null
      : this.parseExpression();
    this.expect(TokenType.Semicolon, "expected ';' after return statement");
    return { kind: "ReturnStatement", value, span: this.spanFrom(start) };
  }

  private parseBreakStatement(): BreakStatement {
    const start = this.advance(); // `break`
    this.expect(TokenType.Semicolon, "expected ';' after 'break'");
    return { kind: "BreakStatement", span: this.spanFrom(start) };
  }

  private parseContinueStatement(): ContinueStatement {
    const start = this.advance(); // `continue`
    this.expect(TokenType.Semicolon, "expected ';' after 'continue'");
    return { kind: "ContinueStatement", span: this.spanFrom(start) };
  }

  /**
   * `"{" { Statement } "}"`. A block introduces a new lexical scope at runtime.
   * Errors inside the block recover locally (synchronize, then continue) so one
   * bad statement does not sink the rest of the block.
   */
  private parseBlockStatement(): BlockStatement {
    const start = this.expect(TokenType.LBrace, "expected '{'");
    const statements: Statement[] = [];
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const before = this.pos;
      try {
        statements.push(this.parseStatement());
      } catch (error) {
        if (error instanceof ParseErrorSignal) {
          this.synchronize();
        } else {
          throw error;
        }
      }
      // Guaranteed progress (see `parse`): never spin inside a block on a token
      // no statement can consume.
      if (
        this.pos === before &&
        !this.check(TokenType.RBrace) &&
        !this.isAtEnd()
      ) {
        this.advance();
      }
    }
    this.expect(TokenType.RBrace, "expected '}' to close block");
    return { kind: "BlockStatement", statements, span: this.spanFrom(start) };
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expression = this.parseExpression();
    this.expect(TokenType.Semicolon, "expected ';' after expression statement");
    return {
      kind: "ExpressionStatement",
      expression,
      span: makeSpan(
        expression.span.start,
        this.previous().span.end,
        this.sourceName,
      ),
    };
  }

  // ── Expressions ────────────────────────────────────────────────────────────

  /**
   * Entry point for expressions. Handles assignment (level 1, right-associative)
   * and delegates everything tighter to the precedence-climbing loop. If a `=`
   * follows a parsed expression, the left side must be an assignment target
   * (Identifier / IndexExpression / MemberExpression); otherwise it is
   * `InvalidAssignmentTarget`, recorded in place with the right side kept so
   * parsing continues.
   */
  private parseExpression(): Expression {
    const left = this.parseBinary(LOWEST_INFIX_PRECEDENCE);
    if (!this.match(TokenType.Assign)) return left;

    const value = this.parseExpression(); // right-associative: a = b = c → a = (b = c)
    const span = mergeSpans(left.span, value.span);
    if (isAssignmentTarget(left)) {
      return { kind: "AssignmentExpression", target: left, value, span };
    }
    this.record(
      ErrorCode.InvalidAssignmentTarget,
      "invalid assignment target (only a variable, index, or property can be assigned to)",
      left.span,
    );
    return value; // recover: surface the right-hand side, which is well-formed
  }

  /**
   * The Pratt precedence-climbing loop over the binary/logical band. Parses a
   * unary operand, then folds in any following infix operator whose binding power
   * is at least `minPrecedence`, recursing at `precedence + 1` for
   * left-associativity.
   */
  private parseBinary(minPrecedence: number): Expression {
    let left = this.parseUnary();
    for (;;) {
      const op = INFIX_OPERATORS[this.peek().type];
      if (op === undefined || op.precedence < minPrecedence) break;
      this.advance();
      const right = this.parseBinary(op.precedence + 1);
      const span = mergeSpans(left.span, right.span);
      left =
        op.node === "logical"
          ? {
              kind: "LogicalExpression",
              operator: op.operator as LogicalOperator,
              left,
              right,
              span,
            }
          : {
              kind: "BinaryExpression",
              operator: op.operator as BinaryOperator,
              left,
              right,
              span,
            };
    }
    return left;
  }

  /** Prefix `-` / `!`, right-associative (a unary may prefix another unary). */
  private parseUnary(): Expression {
    if (this.check(TokenType.Minus) || this.check(TokenType.Bang)) {
      const opToken = this.advance();
      const operator: UnaryOperator =
        opToken.type === TokenType.Minus ? "-" : "!";
      const operand = this.parseUnary();
      const node: UnaryExpression = {
        kind: "UnaryExpression",
        operator,
        operand,
        span: makeSpan(opToken.span.start, operand.span.end, this.sourceName),
      };
      return node;
    }
    return this.parsePostfix();
  }

  /**
   * Postfix call / index / member suffixes, left-associative and chainable, so
   * `o.a[i](x).b` groups as `((((o.a)[i])(x)).b)`.
   */
  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.check(TokenType.LParen)) {
        expr = this.finishCall(expr);
      } else if (this.check(TokenType.LBracket)) {
        expr = this.finishIndex(expr);
      } else if (this.check(TokenType.Dot)) {
        expr = this.finishMember(expr);
      } else {
        break;
      }
    }
    return expr;
  }

  private finishCall(callee: Expression): CallExpression {
    this.advance(); // `(`
    const args: Expression[] = [];
    if (!this.check(TokenType.RParen)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.Comma));
    }
    const end = this.expect(
      TokenType.RParen,
      "expected ')' after call arguments",
    );
    return {
      kind: "CallExpression",
      callee,
      args,
      span: makeSpan(callee.span.start, end.span.end, this.sourceName),
    };
  }

  private finishIndex(object: Expression): IndexExpression {
    this.advance(); // `[`
    const index = this.parseExpression();
    const end = this.expect(
      TokenType.RBracket,
      "expected ']' after index expression",
    );
    return {
      kind: "IndexExpression",
      object,
      index,
      span: makeSpan(object.span.start, end.span.end, this.sourceName),
    };
  }

  private finishMember(object: Expression): MemberExpression {
    this.advance(); // `.`
    const property = this.expect(
      TokenType.Identifier,
      "expected a property name after '.'",
    );
    return {
      kind: "MemberExpression",
      object,
      property: property.lexeme,
      propertySpan: property.span,
      span: makeSpan(object.span.start, property.span.end, this.sourceName),
    };
  }

  /**
   * The atoms of an expression: literals, an identifier, a bracketed / braced
   * literal, a function literal, or a parenthesized expression. A token that
   * cannot begin an expression is `ExpectedExpression`.
   */
  private parsePrimary(): Expression {
    // The expression atoms. An `if`/`else` chain (not a `switch`) because most of
    // the `TokenType` union falls through to the `ExpectedExpression` error.
    const token = this.peek();
    const type = token.type;
    if (type === TokenType.Number) {
      this.advance();
      return {
        kind: "NumberLiteral",
        value: token.value as number,
        span: token.span,
      };
    }
    if (type === TokenType.String) {
      this.advance();
      return {
        kind: "StringLiteral",
        value: token.value as string,
        span: token.span,
      };
    }
    if (type === TokenType.True) {
      this.advance();
      return { kind: "BooleanLiteral", value: true, span: token.span };
    }
    if (type === TokenType.False) {
      this.advance();
      return { kind: "BooleanLiteral", value: false, span: token.span };
    }
    if (type === TokenType.Null) {
      this.advance();
      return { kind: "NullLiteral", span: token.span };
    }
    if (type === TokenType.Identifier) {
      this.advance();
      return { kind: "Identifier", name: token.lexeme, span: token.span };
    }
    if (type === TokenType.LBracket) return this.parseArrayLiteral();
    if (type === TokenType.LBrace) return this.parseObjectLiteral();
    if (type === TokenType.Fn) return this.parseFunctionLiteral();
    if (type === TokenType.LParen) return this.parseGrouping();
    throw this.fail(
      ErrorCode.ExpectedExpression,
      `expected an expression but found ${describeToken(token)}`,
      token.span,
    );
  }

  private parseArrayLiteral(): ArrayLiteral {
    const start = this.advance(); // `[`
    const elements: Expression[] = [];
    if (!this.check(TokenType.RBracket)) {
      do {
        elements.push(this.parseExpression());
      } while (this.match(TokenType.Comma));
    }
    this.expect(TokenType.RBracket, "expected ']' to close array literal");
    return { kind: "ArrayLiteral", elements, span: this.spanFrom(start) };
  }

  private parseObjectLiteral(): ObjectLiteral {
    const start = this.advance(); // `{`
    const entries: ObjectEntry[] = [];
    if (!this.check(TokenType.RBrace)) {
      do {
        entries.push(this.parseObjectEntry());
      } while (this.match(TokenType.Comma));
    }
    this.expect(TokenType.RBrace, "expected '}' to close object literal");
    return { kind: "ObjectLiteral", entries, span: this.spanFrom(start) };
  }

  /** `( IDENT | STRING ) ":" Expression` — both key forms denote a string key. */
  private parseObjectEntry(): ObjectEntry {
    const keyToken = this.peek();
    let key: string;
    if (keyToken.type === TokenType.Identifier) {
      key = keyToken.lexeme;
      this.advance();
    } else if (keyToken.type === TokenType.String) {
      key = keyToken.value as string;
      this.advance();
    } else {
      throw this.fail(
        ErrorCode.ExpectedToken,
        "expected an object key (an identifier or string) ",
        keyToken.span,
      );
    }
    this.expect(TokenType.Colon, "expected ':' after object key");
    const value = this.parseExpression();
    return { key, keySpan: keyToken.span, value };
  }

  private parseFunctionLiteral(): FunctionLiteral {
    const start = this.advance(); // `fn`
    const params = this.parseParameterList();
    const body = this.parseBlockStatement();
    return {
      kind: "FunctionLiteral",
      params,
      body,
      span: this.spanFrom(start),
    };
  }

  /** `"(" Expression ")"` — parentheses only group; they build no AST node. */
  private parseGrouping(): Expression {
    this.advance(); // `(`
    const expr = this.parseExpression();
    this.expect(
      TokenType.RParen,
      "expected ')' to close a parenthesized expression",
    );
    return expr;
  }

  // ── Span helper ────────────────────────────────────────────────────────────

  /** A span from `start`'s first position through the last consumed token's end. */
  private spanFrom(start: Token): Span {
    return makeSpan(
      start.span.start,
      this.previous().span.end,
      this.sourceName,
    );
  }
}

/** Narrow an expression to the three assignable forms fixed by `AssignmentTarget`. */
function isAssignmentTarget(expr: Expression): expr is AssignmentTarget {
  return (
    expr.kind === "Identifier" ||
    expr.kind === "IndexExpression" ||
    expr.kind === "MemberExpression"
  );
}

/** A short human label for a token, for `ExpectedExpression` messages. */
function describeToken(token: Token): string {
  if (token.type === TokenType.EOF) return "end of input";
  return `'${token.lexeme}'`;
}
