import { describe, it, expect } from "vitest";

import { ErrorCode, TokenType } from "@contracts";
import { Lexer } from "../../src/lexer";

// ── Helpers ──────────────────────────────────────────────────────────────────

const lex = (src: string, name = "test.kl") => new Lexer(src, name).tokenize();
const typesOf = (src: string): TokenType[] =>
  lex(src).tokens.map((t) => t.type);
const codesOf = (src: string): ErrorCode[] =>
  lex(src).errors.map((e) => e.code);

// ── EOF invariant ────────────────────────────────────────────────────────────

describe("EOF", () => {
  it("emits exactly one trailing EOF for empty input", () => {
    expect(typesOf("")).toEqual([TokenType.EOF]);
  });

  it("treats a whitespace-only source as empty (only EOF)", () => {
    expect(typesOf("   \n\t \r\n  ")).toEqual([TokenType.EOF]);
  });

  it("always terminates with a single EOF, last", () => {
    for (const src of ["1 + 2", "let x = 3;", "@ # $", '"unterminated']) {
      const { tokens } = lex(src);
      expect(tokens.filter((t) => t.type === TokenType.EOF)).toHaveLength(1);
      expect(tokens.at(-1)?.type).toBe(TokenType.EOF);
    }
  });

  it("gives EOF a zero-width span at the end position", () => {
    const { tokens } = lex("ab");
    const eof = tokens.at(-1);
    expect(eof?.type).toBe(TokenType.EOF);
    expect(eof?.span.start).toEqual({ offset: 2, line: 1, column: 3 });
    expect(eof?.span.end).toEqual({ offset: 2, line: 1, column: 3 });
    expect(eof?.lexeme).toBe("");
  });
});

// ── Keywords vs identifiers ──────────────────────────────────────────────────

describe("keywords", () => {
  const KEYWORD_CASES: ReadonlyArray<readonly [string, TokenType]> = [
    ["let", TokenType.Let],
    ["fn", TokenType.Fn],
    ["return", TokenType.Return],
    ["if", TokenType.If],
    ["else", TokenType.Else],
    ["while", TokenType.While],
    ["for", TokenType.For],
    ["break", TokenType.Break],
    ["continue", TokenType.Continue],
    ["true", TokenType.True],
    ["false", TokenType.False],
    ["null", TokenType.Null],
  ];

  it.each(KEYWORD_CASES)("classifies %s as its keyword token", (src, type) => {
    const { tokens } = lex(src);
    expect(tokens[0]?.type).toBe(type);
    expect(tokens[1]?.type).toBe(TokenType.EOF);
  });

  it("keyword-spelled literals carry no decoded value payload", () => {
    for (const src of ["true", "false", "null"]) {
      expect(lex(src).tokens[0]?.value).toBeUndefined();
    }
  });
});

describe("identifiers", () => {
  it.each([
    "x",
    "_",
    "_foo",
    "foo123",
    "letx", // keyword prefix but not a keyword
    "iffy",
    "trueish",
    "camelCase",
    "PascalCase",
  ])("classifies %s as an Identifier", (src) => {
    const { tokens } = lex(src);
    expect(tokens[0]?.type).toBe(TokenType.Identifier);
    expect(tokens[0]?.lexeme).toBe(src);
    expect(tokens[0]?.value).toBeUndefined();
  });
});

// ── Punctuation & operators (every TokenType in this group) ──────────────────

describe("punctuation and operators", () => {
  const CASES: ReadonlyArray<readonly [string, TokenType]> = [
    ["(", TokenType.LParen],
    [")", TokenType.RParen],
    ["{", TokenType.LBrace],
    ["}", TokenType.RBrace],
    ["[", TokenType.LBracket],
    ["]", TokenType.RBracket],
    [",", TokenType.Comma],
    [";", TokenType.Semicolon],
    [":", TokenType.Colon],
    [".", TokenType.Dot],
    ["+", TokenType.Plus],
    ["-", TokenType.Minus],
    ["*", TokenType.Star],
    ["/", TokenType.Slash],
    ["%", TokenType.Percent],
    ["=", TokenType.Assign],
    ["==", TokenType.Eq],
    ["!=", TokenType.NotEq],
    ["<", TokenType.Lt],
    [">", TokenType.Gt],
    ["<=", TokenType.LtEq],
    [">=", TokenType.GtEq],
    ["!", TokenType.Bang],
    ["&&", TokenType.And],
    ["||", TokenType.Or],
  ];

  it.each(CASES)("scans %s", (src, type) => {
    const { tokens } = lex(src);
    expect(tokens[0]?.type).toBe(type);
    expect(tokens[0]?.lexeme).toBe(src);
    expect(tokens[0]?.value).toBeUndefined();
    expect(tokens[1]?.type).toBe(TokenType.EOF);
  });

  it("prefers the two-character operator when it applies (maximal munch)", () => {
    expect(typesOf("<=")).toEqual([TokenType.LtEq, TokenType.EOF]);
    expect(typesOf("< =")).toEqual([
      TokenType.Lt,
      TokenType.Assign,
      TokenType.EOF,
    ]);
    expect(typesOf("===")).toEqual([
      TokenType.Eq,
      TokenType.Assign,
      TokenType.EOF,
    ]);
  });

  it("distinguishes a Dot from a leading-dot number and member access", () => {
    expect(typesOf("..")).toEqual([
      TokenType.Dot,
      TokenType.Dot,
      TokenType.EOF,
    ]);
    expect(typesOf(".a")).toEqual([
      TokenType.Dot,
      TokenType.Identifier,
      TokenType.EOF,
    ]);
    expect(typesOf(".5")).toEqual([TokenType.Number, TokenType.EOF]);
  });
});

// ── A representative program ─────────────────────────────────────────────────

describe("a whole declaration", () => {
  it("tokenizes a function declaration into the expected stream", () => {
    expect(typesOf("let add = fn(a, b) { return a + b; };")).toEqual([
      TokenType.Let,
      TokenType.Identifier,
      TokenType.Assign,
      TokenType.Fn,
      TokenType.LParen,
      TokenType.Identifier,
      TokenType.Comma,
      TokenType.Identifier,
      TokenType.RParen,
      TokenType.LBrace,
      TokenType.Return,
      TokenType.Identifier,
      TokenType.Plus,
      TokenType.Identifier,
      TokenType.Semicolon,
      TokenType.RBrace,
      TokenType.Semicolon,
      TokenType.EOF,
    ]);
  });

  it("lexes a right-associative assignment chain positionally", () => {
    expect(typesOf("x = y = 1")).toEqual([
      TokenType.Identifier,
      TokenType.Assign,
      TokenType.Identifier,
      TokenType.Assign,
      TokenType.Number,
      TokenType.EOF,
    ]);
  });
});

// ── Numbers: all three literal forms ─────────────────────────────────────────

describe("number literals", () => {
  const NUMBER_CASES: ReadonlyArray<readonly [string, number]> = [
    ["0", 0],
    ["42", 42],
    ["3.14", 3.14],
    [".5", 0.5],
    ["1e10", 1e10],
    ["6.022e23", 6.022e23],
    ["2.5e-3", 2.5e-3],
    ["1E3", 1000],
    ["10e+2", 1000],
    ["0xFF", 255],
    ["0x10", 16],
    ["0xdead", 57005],
    ["0X1a", 26],
  ];

  it.each(NUMBER_CASES)("decodes %s once into its numeric value", (src, n) => {
    const { tokens, errors } = lex(src);
    expect(errors).toEqual([]);
    expect(tokens[0]?.type).toBe(TokenType.Number);
    expect(tokens[0]?.value).toBe(n);
    expect(tokens[0]?.lexeme).toBe(src);
    expect(tokens[1]?.type).toBe(TokenType.EOF);
  });

  it("stops a number before a following member access (`1.foo`)", () => {
    const { tokens } = lex("1.foo");
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.Number,
      TokenType.Dot,
      TokenType.Identifier,
      TokenType.EOF,
    ]);
    expect(tokens[0]?.value).toBe(1);
  });

  it("splits `1.2.3` into two number literals", () => {
    const { tokens } = lex("1.2.3");
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.Number,
      TokenType.Number,
      TokenType.EOF,
    ]);
    expect(tokens[0]?.value).toBe(1.2);
    expect(tokens[1]?.value).toBe(0.3);
  });
});

// ── Strings: decoding and every escape ───────────────────────────────────────

describe("string literals", () => {
  it("decodes a plain string and retains the quoted lexeme", () => {
    const { tokens } = lex('"hello"');
    expect(tokens[0]?.type).toBe(TokenType.String);
    expect(tokens[0]?.value).toBe("hello");
    expect(tokens[0]?.lexeme).toBe('"hello"');
  });

  it("decodes the empty string", () => {
    expect(lex('""').tokens[0]?.value).toBe("");
  });

  const ESCAPE_CASES: ReadonlyArray<readonly [string, string]> = [
    [String.raw`"\n"`, "\n"],
    [String.raw`"\t"`, "\t"],
    [String.raw`"\r"`, "\r"],
    [String.raw`"\\"`, "\\"],
    [String.raw`"\""`, '"'],
    [String.raw`"\0"`, "\0"],
    [String.raw`"a\tb\nc"`, "a\tb\nc"],
  ];

  it.each(ESCAPE_CASES)("resolves the escape(s) in %s", (src, value) => {
    const { tokens, errors } = lex(src);
    expect(errors).toEqual([]);
    expect(tokens[0]?.type).toBe(TokenType.String);
    expect(tokens[0]?.value).toBe(value);
  });

  it("decodes a valid \\uXXXX escape to its code unit", () => {
    // Source text: "  \  u  0  0  4  1  " (a real backslash, not a JS escape).
    expect(lex('"\\u0041"').tokens[0]?.value).toBe("A");
    expect(lex('"caf\\u00e9"').tokens[0]?.value).toBe("café");
  });

  it("counts columns in UTF-16 code units through an astral character", () => {
    const { tokens } = lex('"😀"'); // '😀' is two UTF-16 code units
    expect(tokens[0]?.type).toBe(TokenType.String);
    expect(tokens[0]?.value).toBe("😀");
    expect(tokens[0]?.span.start).toEqual({ offset: 0, line: 1, column: 1 });
    expect(tokens[0]?.span.end).toEqual({ offset: 4, line: 1, column: 5 });
  });
});

// ── Comments are trivia, not tokens ──────────────────────────────────────────

describe("comments", () => {
  it("skips a line comment and resumes after the newline", () => {
    expect(typesOf("// hi\nx")).toEqual([TokenType.Identifier, TokenType.EOF]);
  });

  it("skips a line comment that runs to end of input", () => {
    expect(typesOf("x // trailing")).toEqual([
      TokenType.Identifier,
      TokenType.EOF,
    ]);
  });

  it("skips an inline block comment", () => {
    expect(typesOf("a /* c */ b")).toEqual([
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.EOF,
    ]);
  });

  it("skips a block comment spanning multiple lines and tracks the line", () => {
    const { tokens } = lex("a /* one\ntwo */ b");
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.EOF,
    ]);
    // `b` sits on the second physical line, after the closing `*/`.
    expect(tokens[1]?.span.start.line).toBe(2);
  });

  it("does not nest block comments: the first */ closes", () => {
    const { tokens, errors } = lex("/* a */ b */");
    expect(errors).toEqual([]);
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.Identifier, // b
      TokenType.Star, // *
      TokenType.Slash, // /
      TokenType.EOF,
    ]);
  });
});

// ── Spans and line/column tracking ───────────────────────────────────────────

describe("spans", () => {
  it("tracks offset, line, and column across a newline", () => {
    const { tokens } = lex("a\nbb");
    const [a, bb, eof] = tokens;
    expect(a?.span.start).toEqual({ offset: 0, line: 1, column: 1 });
    expect(a?.span.end).toEqual({ offset: 1, line: 1, column: 2 });
    expect(bb?.span.start).toEqual({ offset: 2, line: 2, column: 1 });
    expect(bb?.span.end).toEqual({ offset: 4, line: 2, column: 3 });
    expect(eof?.span.start).toEqual({ offset: 4, line: 2, column: 3 });
  });

  it("spans a two-character operator across both code units", () => {
    const { tokens } = lex("==");
    expect(tokens[0]?.span.start).toEqual({ offset: 0, line: 1, column: 1 });
    expect(tokens[0]?.span.end).toEqual({ offset: 2, line: 1, column: 3 });
  });

  it("carries the configured source name on every span", () => {
    const { tokens } = lex("x", "main.kl");
    expect(tokens[0]?.span.source).toBe("main.kl");
    expect(tokens.at(-1)?.span.source).toBe("main.kl");
  });

  it("defaults the source name to <script>", () => {
    expect(new Lexer("x").tokenize().tokens[0]?.span.source).toBe("<script>");
  });
});

// ── Literal value presence contract ──────────────────────────────────────────

describe("value payload contract", () => {
  it("attaches value only to Number and String tokens", () => {
    const { tokens } = lex('1 "s" x + true');
    const byType = new Map(tokens.map((t) => [t.type, t] as const));
    expect(byType.get(TokenType.Number)?.value).toBe(1);
    expect(byType.get(TokenType.String)?.value).toBe("s");
    expect(byType.get(TokenType.Identifier)?.value).toBeUndefined();
    expect(byType.get(TokenType.Plus)?.value).toBeUndefined();
    expect(byType.get(TokenType.True)?.value).toBeUndefined();
  });
});

// ── Lexical errors: each ErrorCode ───────────────────────────────────────────

describe("lexical errors", () => {
  it("E1001 UnexpectedCharacter for stray symbols and lone & / |", () => {
    for (const src of ["@", "#", "$", "~", "^", "?", "&", "|"]) {
      expect(codesOf(src)).toEqual([ErrorCode.UnexpectedCharacter]);
      // No token is emitted for the bad character; only EOF remains.
      expect(typesOf(src)).toEqual([TokenType.EOF]);
    }
  });

  it("E1002 UnterminatedString at end of input", () => {
    const { tokens, errors } = lex('"abc');
    expect(errors.map((e) => e.code)).toEqual([ErrorCode.UnterminatedString]);
    expect(tokens.map((t) => t.type)).toEqual([TokenType.EOF]);
  });

  it("E1002 UnterminatedString when a newline interrupts the string", () => {
    expect(codesOf('"abc\n')).toEqual([ErrorCode.UnterminatedString]);
  });

  it("E1003 InvalidEscape but still emits the recovered string token", () => {
    const { tokens, errors } = lex('"a\\qb"');
    expect(errors.map((e) => e.code)).toEqual([ErrorCode.InvalidEscape]);
    expect(tokens[0]?.type).toBe(TokenType.String);
    expect(tokens[0]?.value).toBe("aqb"); // unknown escape recovered literally
  });

  it("E1003 InvalidEscape for a malformed unicode escape", () => {
    const { tokens, errors } = lex('"\\u12"');
    expect(errors.map((e) => e.code)).toEqual([ErrorCode.InvalidEscape]);
    expect(tokens[0]?.type).toBe(TokenType.String);
    expect(tokens[0]?.value).toBe("u12");
  });

  it("E1003 InvalidEscape for a dangling backslash at end of input", () => {
    // Source text: "  a  b  \   (backslash then EOF — no closing quote).
    const { tokens, errors } = lex('"ab\\');
    expect(errors.map((e) => e.code)).toEqual([
      ErrorCode.InvalidEscape, // the incomplete escape
      ErrorCode.UnterminatedString, // then the unclosed string
    ]);
    expect(tokens.map((t) => t.type)).toEqual([TokenType.EOF]);
  });

  it.each(["0x", "1e", "1e+", "123abc", "0xFG", "1_000"])(
    "E1004 InvalidNumber for %s (and emits no number token)",
    (src) => {
      expect(codesOf(src)).toEqual([ErrorCode.InvalidNumber]);
      expect(typesOf(src)).toEqual([TokenType.EOF]);
    },
  );

  it("E1005 UnterminatedComment for an unclosed block comment", () => {
    const { tokens, errors } = lex("/* never closed");
    expect(errors.map((e) => e.code)).toEqual([ErrorCode.UnterminatedComment]);
    expect(tokens.map((t) => t.type)).toEqual([TokenType.EOF]);
  });

  it("anchors an error to the offending source span", () => {
    const { errors } = lex("@");
    expect(errors[0]?.code).toBe(ErrorCode.UnexpectedCharacter);
    expect(errors[0]?.span.start).toEqual({ offset: 0, line: 1, column: 1 });
    expect(errors[0]?.span.end).toEqual({ offset: 1, line: 1, column: 2 });
    expect(errors[0]?.phase).toBe("lexical");
  });
});

// ── Error recovery: keep scanning, collect many, keep good tokens ────────────

describe("error recovery", () => {
  it("recovers past an unexpected character and keeps surrounding tokens", () => {
    const { tokens, errors } = lex("1 @ 2");
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.Number,
      TokenType.Number,
      TokenType.EOF,
    ]);
    expect(errors).toHaveLength(1);
  });

  it("collects multiple errors of the same kind in one pass", () => {
    expect(codesOf("@ # $")).toEqual([
      ErrorCode.UnexpectedCharacter,
      ErrorCode.UnexpectedCharacter,
      ErrorCode.UnexpectedCharacter,
    ]);
  });

  it("collects errors of different kinds while still emitting valid tokens", () => {
    const { tokens, errors } = lex("1e + @");
    expect(errors.map((e) => e.code)).toEqual([
      ErrorCode.InvalidNumber, // 1e
      ErrorCode.UnexpectedCharacter, // @
    ]);
    expect(tokens.map((t) => t.type)).toEqual([TokenType.Plus, TokenType.EOF]);
  });
});
