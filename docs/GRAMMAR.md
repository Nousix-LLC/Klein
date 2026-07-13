# The Klein Grammar

This document is the **formal grammar of Klein** — the complete description of the
language's surface syntax, in EBNF. It is a companion to
[`LANGUAGE.md`](./LANGUAGE.md): where that document fixes what a Klein program
_means_, this one fixes what a Klein program may _look like_.

The grammar is not an independent authority. It mirrors two fixed sources exactly
and invents nothing beyond them:

- The **AST** in `contracts/ast.ts` fixes the set of constructs. Every production
  below corresponds to an AST node, and every AST node has a production — no
  orphan productions and no missing constructs (see
  [AST coverage](#ast-coverage)).
- The **terminals** are the token kinds fixed by `contracts/tokens.ts`
  (`TokenType`, `KEYWORDS`), and the **operator precedence and associativity**
  are the authoritative table in
  [`LANGUAGE.md` §Operators](./LANGUAGE.md#operators-precedence-and-associativity).
  This grammar encodes that precedence _structurally_ (one grammar level per
  precedence level); if the encoded structure and that table ever disagree, the
  table in `LANGUAGE.md` governs and this grammar is in error.

Where a fine-grained lexical detail is not fixed by the contracts (the exact
identifier character class, some numeric edge cases, trailing commas), this
document says so explicitly rather than guessing, matching the deferral posture
of `LANGUAGE.md`.

---

## Notation

The grammar is written in a conventional EBNF. The metasyntax is:

| Form           | Meaning                                             |
| -------------- | --------------------------------------------------- |
| `Name = ... ;` | A production rule named `Name`.                     |
| `a b`          | Sequence: `a` followed by `b` (juxtaposition).      |
| `a \| b`       | Alternation: `a` or `b`.                            |
| `( a b )`      | Grouping.                                           |
| `[ a ]`        | Optional: zero or one occurrence of `a`.            |
| `{ a }`        | Repetition: zero or more occurrences of `a`.        |
| `"if"` `"+"`   | A terminal, given by its exact source spelling.     |
| `UPPERCASE`    | A terminal token kind from the lexical grammar.     |
| `Mixed_Case`   | A non-terminal (a production defined in this file). |
| `(* ... *)`    | A comment; not part of the language.                |

Two conventions keep the grammar readable and faithful to the pipeline:

- **Terminals are tokens, not characters.** The syntactic grammar
  ([§Syntactic grammar](#syntactic-grammar)) consumes the token stream produced
  by the lexer. Its terminals are token kinds — punctuation and operators are
  written with their source spelling (`"("`, `"&&"`), and the four token kinds
  with variable text are written in uppercase: `IDENTIFIER`, `NUMBER`, `STRING`,
  and `EOF`. The lexical grammar ([§Lexical grammar](#lexical-grammar)) defines
  those four in terms of source characters.
- **Whitespace and comments are invisible to the parser.** They separate tokens
  and are then discarded by the lexer (see
  [§Whitespace and comments](#whitespace-and-comments)); they never appear in the
  syntactic grammar.

---

## Lexical grammar

The lexer turns source text into a stream of tokens, discarding whitespace and
comments and appending exactly one synthetic `EOF` token at the end. The complete,
closed set of token kinds is `TokenType` in `contracts/tokens.ts`; the productions
here describe the source spelling of each kind.

```ebnf
(* A token is one of: a keyword, an identifier, a literal, or a
   punctuator/operator. The lexer also recognizes whitespace and comments,
   which separate tokens and are discarded (not emitted). *)

Token = Keyword | IDENTIFIER | NUMBER | STRING | Punctuator | Operator ;
```

### Whitespace and comments

```ebnf
Whitespace   = { " " | "\t" | "\r" | "\n" } ;   (* insignificant; separates tokens *)

Comment      = LineComment | BlockComment ;
LineComment  = "//" { AnyCharExceptNewline } ;
BlockComment = "/*" { AnyChar } "*/" ;
```

Klein is **not** whitespace-sensitive: spaces, tabs, carriage returns, and
newlines only separate tokens. Block comments **do not nest** — the first `*/`
closes the comment opened by the most recent `/*`, regardless of any intervening
`/*`. A block comment with no closing `*/` is a lexical error
(`UnterminatedComment`, `E1005`).

### Identifiers and keywords

```ebnf
IDENTIFIER  = IdentStart { IdentPart } ;   (* excluding any Keyword spelling *)
IdentStart  = Letter | "_" ;
IdentPart   = Letter | Digit | "_" ;
Letter      = "a" … "z" | "A" … "Z" ;
Digit       = "0" … "9" ;

Keyword     = "let" | "fn"   | "return" | "if"    | "else"  | "while"
            | "for" | "break" | "continue" | "true" | "false" | "null" ;
```

The lexer reads a maximal `IdentStart IdentPart*` run, then classifies it: if the
lexeme is one of the `KEYWORDS` (`contracts/tokens.ts`) it becomes that keyword's
token, otherwise it becomes an `IDENTIFIER`. Thus `true`, `false`, and `null` are
keyword-spelled literal tokens (`True`, `False`, `Null`), not identifiers, and
cannot be rebound.

> The precise identifier character class (for example, whether non-ASCII letters
> are permitted) is owned by the lexer and is not fixed by `contracts/`. The
> production above states the conventional and intended form — an ASCII
> letter-or-underscore start followed by letters, digits, or underscores — which
> covers every identifier used in the specification and examples.

### Number literals

```ebnf
NUMBER     = HexNumber | DecNumber ;

HexNumber  = "0x" HexDigit { HexDigit } ;
HexDigit   = Digit | "a" … "f" | "A" … "F" ;

DecNumber  = ( Fraction | Integer ) [ Exponent ] ;
Integer    = Digit { Digit } ;
Fraction   = Digit { Digit } "." Digit { Digit }   (* e.g. 3.14 *)
           | "." Digit { Digit } ;                  (* e.g. .5   *)
Exponent   = ( "e" | "E" ) [ "+" | "-" ] Digit { Digit } ;
```

Numeric literals come in three forms — decimal (`0`, `42`, `3.14`, `.5`),
exponent (`1e10`, `6.022e23`, `2.5e-3`), and hexadecimal (`0xFF`, `0x10`,
`0xdead`). A malformed numeric literal is a lexical error (`InvalidNumber`,
`E1004`). The exact numeric-lexing edge cases are owned by the lexer, consistent
with `LANGUAGE.md`; the forms above are the fixed shapes.

### String literals

```ebnf
STRING     = '"' { StringChar } '"' ;
StringChar = Escape | AnyCharExcept_Quote_Backslash_Newline ;
Escape     = "\" ( "n" | "t" | "r" | "\" | '"' | "0"
                 | "u" HexDigit HexDigit HexDigit HexDigit ) ;
```

A string is written between double quotes. The recognized escapes are exactly
`\n`, `\t`, `\r`, `\\`, `\"`, `\0`, and `\uXXXX` (four hex digits). An
unrecognized escape is `InvalidEscape` (`E1003`); a string with no closing quote
before end-of-line or end-of-input is `UnterminatedString` (`E1002`). The lexer
stores the decoded string value on the token.

### Punctuation and operators

Each terminal below is a single token kind (`TokenType` in `contracts/tokens.ts`,
shown in parentheses). Multi-character operators are matched maximally, so `==`,
`!=`, `<=`, `>=`, `&&`, and `||` are single tokens, never two.

```ebnf
Punctuator = "("   (* LParen *)   | ")"   (* RParen *)
           | "{"   (* LBrace *)   | "}"   (* RBrace *)
           | "["   (* LBracket *) | "]"   (* RBracket *)
           | ","   (* Comma *)    | ";"   (* Semicolon *)
           | ":"   (* Colon *)    | "."   (* Dot *) ;

Operator   = "+"   (* Plus *)     | "-"   (* Minus *)
           | "*"   (* Star *)     | "/"   (* Slash *)
           | "%"   (* Percent *)  | "="   (* Assign *)
           | "=="  (* Eq *)       | "!="  (* NotEq *)
           | "<"   (* Lt *)       | ">"   (* Gt *)
           | "<="  (* LtEq *)     | ">="  (* GtEq *)
           | "!"   (* Bang *)     | "&&"  (* And *)
           | "||"  (* Or *) ;
```

The lexer additionally emits one synthetic `EOF` token, last, marking the end of
input; it has no source spelling.

---

## Syntactic grammar

The parser consumes the token stream and produces a `Program` AST
(`contracts/ast.ts`). The productions below take token kinds as their terminals.

### Program and statements

```ebnf
Program   = { Statement } EOF ;

Statement = LetStatement
          | FunctionDeclaration
          | IfStatement
          | WhileStatement
          | ForStatement
          | ReturnStatement
          | BreakStatement
          | ContinueStatement
          | BlockStatement
          | ExpressionStatement ;

LetStatement        = "let" IDENTIFIER "=" Expression ";" ;

ExpressionStatement = Expression ";" ;

BlockStatement      = "{" { Statement } "}" ;

ReturnStatement     = "return" [ Expression ] ";" ;

BreakStatement      = "break" ";" ;

ContinueStatement   = "continue" ";" ;
```

A `let` binding **must** have an initializer (there is no bare `let x;`). A
`return` with no operand yields `null`. A block `{ ... }` groups statements and
introduces a new lexical scope.

### Function declarations

```ebnf
FunctionDeclaration = "fn" IDENTIFIER "(" [ ParameterList ] ")" BlockStatement ;

ParameterList       = IDENTIFIER { "," IDENTIFIER } ;
```

A function _declaration_ is a statement that binds a named function. (The
anonymous _function literal_ `fn(...) { ... }` is an expression; see
[§Primary expressions](#primary-expressions).) Both share the parameter-list and
body shape. Repeating a parameter name within one list is a syntax error
(`DuplicateParameter`, `E2005`), enforced by the parser.

### Conditionals

```ebnf
IfStatement = "if" "(" Expression ")" BlockStatement
              [ "else" ( IfStatement | BlockStatement ) ] ;
```

`else if` is **not** a separate construct: an `else` followed directly by another
`if` produces an alternate that is itself an `IfStatement`, exactly as
`IfStatement.alternate` in `contracts/ast.ts` allows (`BlockStatement`,
`IfStatement`, or none). The consequent and any final `else` alternate are always
blocks.

### Loops

```ebnf
WhileStatement = "while" "(" Expression ")" BlockStatement ;

ForStatement   = "for" "(" [ ForInit ] ";" [ Expression ] ";" [ Expression ] ")"
                 BlockStatement ;
ForInit        = "let" IDENTIFIER "=" Expression   (* a let binding    *)
               | Expression ;                        (* an expression    *)
```

Klein's `for` is the C-style three-clause loop; all three clauses are optional
(matching `ForStatement` in `contracts/ast.ts`, whose `init`, `condition`, and
`update` are each nullable). The two `;` in the header are the clause separators,
so the `ForInit` clause is written **without** its own trailing `;`. An omitted
condition is treated as always true, so `for (;;) { ... }` is a bare infinite
loop. A `let` in `ForInit` is scoped to the loop.

### Expressions and operator precedence

Expressions are defined as a cascade of one production per precedence level. Each
level delegates to the next-tighter level, so precedence and associativity are
encoded **structurally** — no separate precedence-resolution pass is needed. The
levels below mirror the authoritative table in
[`LANGUAGE.md` §Operators](./LANGUAGE.md#operators-precedence-and-associativity),
reproduced here for reference (1 binds loosest, 9 binds tightest):

| Level | Category          | Operators             | Associativity  | AST node               |
| ----- | ----------------- | --------------------- | -------------- | ---------------------- |
| 1     | Assignment        | `=`                   | right          | `AssignmentExpression` |
| 2     | Logical OR        | `\|\|`                | left           | `LogicalExpression`    |
| 3     | Logical AND       | `&&`                  | left           | `LogicalExpression`    |
| 4     | Equality          | `==` `!=`             | left           | `BinaryExpression`     |
| 5     | Relational        | `<` `>` `<=` `>=`     | left           | `BinaryExpression`     |
| 6     | Additive          | `+` `-`               | left           | `BinaryExpression`     |
| 7     | Multiplicative    | `*` `/` `%`           | left           | `BinaryExpression`     |
| 8     | Unary (prefix)    | `-` `!`               | right (prefix) | `UnaryExpression`      |
| 9     | Postfix / primary | `f(...)` `a[i]` `o.k` | left           | see productions        |

```ebnf
Expression     = Assignment ;

(* Level 1 — assignment, right-associative. If "=" is present, the Assignment
   on the left MUST be an assignment target (Identifier, IndexExpression, or
   MemberExpression); any other left-hand side is InvalidAssignmentTarget
   (E2004), reported by the parser. Right-recursion gives a = b = c the
   grouping a = (b = c). *)
Assignment     = LogicalOr [ "=" Assignment ] ;

(* Levels 2–3 — short-circuiting logical operators, left-associative.
   These build LogicalExpression nodes, kept distinct from BinaryExpression
   because they short-circuit. *)
LogicalOr      = LogicalAnd { "||" LogicalAnd } ;
LogicalAnd     = Equality   { "&&" Equality } ;

(* Levels 4–7 — binary operators, left-associative. Each builds a
   BinaryExpression node. *)
Equality       = Relational     { ( "==" | "!=" )        Relational } ;
Relational     = Additive       { ( "<" | ">" | "<=" | ">=" ) Additive } ;
Additive       = Multiplicative { ( "+" | "-" )          Multiplicative } ;
Multiplicative = Unary          { ( "*" | "/" | "%" )     Unary } ;

(* Level 8 — prefix unary, right-associative (a unary operator may prefix
   another unary expression). Builds a UnaryExpression node. *)
Unary          = ( "-" | "!" ) Unary
               | Postfix ;

(* Level 9 — postfix call / index / member, left-associative and chainable, so
   o.a[i](x).b groups as ((((o.a)[i])(x)).b). Each suffix builds, respectively,
   a CallExpression, IndexExpression, or MemberExpression. *)
Postfix        = Primary { CallSuffix | IndexSuffix | MemberSuffix } ;
CallSuffix     = "(" [ ArgumentList ] ")" ;
IndexSuffix    = "[" Expression "]" ;
MemberSuffix   = "." IDENTIFIER ;
ArgumentList   = Expression { "," Expression } ;
```

### Primary expressions

The primary level sits below every operator: the atoms of an expression, plus a
parenthesized expression that overrides precedence. Parentheses only group; they
are not an operator and build no node of their own.

```ebnf
Primary        = NUMBER            (* NumberLiteral  *)
               | STRING            (* StringLiteral  *)
               | "true"            (* BooleanLiteral *)
               | "false"           (* BooleanLiteral *)
               | "null"            (* NullLiteral    *)
               | IDENTIFIER        (* Identifier     *)
               | ArrayLiteral
               | ObjectLiteral
               | FunctionLiteral
               | Grouping ;

Grouping       = "(" Expression ")" ;

ArrayLiteral   = "[" [ Expression { "," Expression } ] "]" ;

ObjectLiteral  = "{" [ ObjectEntry { "," ObjectEntry } ] "}" ;
ObjectEntry    = ( IDENTIFIER | STRING ) ":" Expression ;

FunctionLiteral = "fn" "(" [ ParameterList ] ")" BlockStatement ;
```

An object-literal key is written as an identifier or a string literal; both denote
a string key (matching `ObjectEntry.key: string` in `contracts/ast.ts`). An empty
array is `[]` and an empty object is `{}`.

> Whether a trailing comma is tolerated in a parameter list, argument list, array
> literal, or object literal is a parser detail not fixed by `contracts/`; the
> productions above show the strict form (no trailing comma). This mirrors the
> deferral posture of `LANGUAGE.md`.

---

## AST coverage

Every construct in `contracts/ast.ts` maps to exactly one production, and every
production maps to a real construct. The tables below make the correspondence
auditable — there are no orphan productions and no missing constructs.

### Expressions (`Expression` union)

| AST node kind          | Production(s)                                          |
| ---------------------- | ------------------------------------------------------ |
| `NumberLiteral`        | `NUMBER` (in `Primary`; lexed by `NUMBER`)             |
| `StringLiteral`        | `STRING` (in `Primary`; lexed by `STRING`)             |
| `BooleanLiteral`       | `"true"` / `"false"` (in `Primary`)                    |
| `NullLiteral`          | `"null"` (in `Primary`)                                |
| `Identifier`           | `IDENTIFIER` (in `Primary`)                            |
| `ArrayLiteral`         | `ArrayLiteral`                                         |
| `ObjectLiteral`        | `ObjectLiteral` (+ `ObjectEntry`)                      |
| `FunctionLiteral`      | `FunctionLiteral`                                      |
| `UnaryExpression`      | `Unary`                                                |
| `BinaryExpression`     | `Equality`, `Relational`, `Additive`, `Multiplicative` |
| `LogicalExpression`    | `LogicalOr`, `LogicalAnd`                              |
| `AssignmentExpression` | `Assignment`                                           |
| `CallExpression`       | `CallSuffix` (in `Postfix`)                            |
| `IndexExpression`      | `IndexSuffix` (in `Postfix`)                           |
| `MemberExpression`     | `MemberSuffix` (in `Postfix`)                          |

Supporting AST types: `ObjectEntry` → `ObjectEntry`; `Parameter` → an
`IDENTIFIER` in `ParameterList`; `AssignmentTarget` → the target constraint noted
on `Assignment`; `UnaryOperator` / `BinaryOperator` / `LogicalOperator` → the
literal operator terminals in their levels.

### Statements (`Statement` union) and root

| AST node kind         | Production            |
| --------------------- | --------------------- |
| `LetStatement`        | `LetStatement`        |
| `ExpressionStatement` | `ExpressionStatement` |
| `BlockStatement`      | `BlockStatement`      |
| `IfStatement`         | `IfStatement`         |
| `WhileStatement`      | `WhileStatement`      |
| `ForStatement`        | `ForStatement`        |
| `ReturnStatement`     | `ReturnStatement`     |
| `BreakStatement`      | `BreakStatement`      |
| `ContinueStatement`   | `ContinueStatement`   |
| `FunctionDeclaration` | `FunctionDeclaration` |
| `Program`             | `Program`             |

---

## Worked examples

The following show the precedence cascade producing the expected structure (see
the same examples under `LANGUAGE.md`):

```klein
1 + 2 * 3     // 7   : Multiplicative (7) binds tighter than Additive (6)
2 + 3 == 5    // true: Additive (6) binds tighter than Equality (4)
-2 * 3        // -6  : Unary (8) binds tighter than Multiplicative (7)
a && b || c   // (a && b) || c : LogicalAnd (3) tighter than LogicalOr (2)
x = y = 1     // x = (y = 1)   : Assignment (1) is right-associative
!a == b       // (!a) == b     : Unary (8) binds tighter than Equality (4)
o.a[i](x).b   // ((((o.a)[i])(x)).b) : postfix suffixes chain left-to-right
```

A small program exercising the statement grammar:

```klein
fn fib(n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

let total = 0;
for (let i = 0; i < 10; i = i + 1) {
  total = total + fib(i);
}
```
