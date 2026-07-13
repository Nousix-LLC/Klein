# The Klein Language Specification

This document is the **authoritative specification of Klein's semantics** — what
a Klein program _means_. It is the narrative expansion of the language summary in
the project hub and the machine-verifiable schema under `contracts/`; every other
document (the EBNF in [`GRAMMAR.md`](./GRAMMAR.md), the README, editor tooling)
treats this file as the semantic authority.

Klein is a small, dynamically-typed language with lexical scope, first-class
closures, and a deliberately predictable value model. It is executed by a
tree-walking interpreter written in TypeScript. The design posture is
conservative on purpose: the language is intentionally small so that its
semantics can be stated exactly and implemented without surprises. Where a
choice existed between a clever rule and a boring, predictable one, Klein takes
the boring one and documents it here.

> **Scope of this document.** Klein's semantics are fixed by two sources: the
> project hub's language summary and the interface schema in `contracts/`
> (`tokens.ts`, `ast.ts`, `values.ts`, `errors.ts`, `pipeline.ts`). This
> specification expands those sources faithfully and invents no behavior beyond
> them. Every value kind, operator, keyword, literal form, and error code named
> here corresponds exactly to a declaration in `contracts/`. Where the fixed
> sources leave a fine-grained detail to the runtime implementation, this
> document says so explicitly rather than guessing (see
> [Deferred and implementation-defined details](#deferred-and-implementation-defined-details)).

---

## Table of contents

1. [A first taste](#a-first-taste)
2. [Lexical structure](#lexical-structure)
3. [Values](#values)
4. [Bindings and scope](#bindings-and-scope)
5. [Assignment as an expression](#assignment-as-an-expression)
6. [Operators, precedence, and associativity](#operators-precedence-and-associativity)
7. [Truthiness](#truthiness)
8. [Equality](#equality)
9. [Expressions](#expressions)
10. [Control flow](#control-flow)
11. [Functions and closures](#functions-and-closures)
12. [The error model](#the-error-model)
13. [Intentional non-goals](#intentional-non-goals)
14. [Deferred and implementation-defined details](#deferred-and-implementation-defined-details)

---

## A first taste

```klein
// Classic recursion: functions are first-class and close over their scope.
fn fib(n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

let counter = fn() {
  let n = 0;
  // The returned closure captures `n` by reference to its defining scope.
  return fn() {
    n = n + 1;
    return n;
  };
};

let next = counter();
println(next()); // 1
println(next()); // 2
println(fib(10)); // 55
```

The rest of this document defines precisely what each of these constructs does.

---

## Lexical structure

Before a Klein program is parsed it is tokenized. The lexer is **error
tolerant**: it records every lexical error it encounters, recovers, and keeps
scanning, so a single run can report many problems. It always produces a token
stream terminated by exactly one synthetic `EOF` token.

The complete, closed set of token kinds is fixed by `TokenType` in
`contracts/tokens.ts`. It comprises literal tokens (`Number`, `String`, `True`,
`False`, `Null`, `Identifier`), the keyword tokens, punctuation, operator
tokens, and `EOF`.

### Whitespace

Spaces, tabs, carriage returns, and newlines separate tokens and are otherwise
insignificant. Klein is **not** whitespace-sensitive and has no significant
indentation; statements are terminated with `;` (see
[Statements](#statements-and-blocks)).

### Comments

Klein has two comment forms:

- **Line comments** begin with `//` and run to the end of the line.
- **Block comments** are delimited by `/*` and `*/`.

Block comments **do not nest**: the first `*/` closes the comment that the most
recent `/*` opened, regardless of any intervening `/*`. A block comment that is
never closed is a lexical error (`UnterminatedComment`, `E1005`).

```klein
// a line comment
let x = 1; /* an inline block comment */
let y = 2;
/* block comments
   may span lines */
```

### Identifiers and keywords

An identifier is a name used for variables, function names, parameters, and
object keys written in identifier form. The lexer classifies an identifier
lexeme by looking it up in the canonical keyword table (`KEYWORDS` in
`contracts/tokens.ts`); a lexeme that is not a keyword becomes an `Identifier`
token.

The **reserved keywords** are exactly:

```text
let  fn  return  if  else  while  for  break  continue  true  false  null
```

`true`, `false`, and `null` are keyword-spelled literals, not identifiers; they
cannot be rebound.

### Literals in source

The literal forms recognized by the lexer are described in full under
[Values](#values). In brief: numbers (decimal, hexadecimal, and
exponent forms), strings (double-quoted, with escapes), and the keyword literals
`true`, `false`, and `null`. Number and string tokens carry a **pre-decoded**
payload — the lexer computes the numeric value and resolves string escapes once,
so later stages never re-parse a lexeme.

---

## Values

Every Klein expression evaluates to a **value**. The set of value kinds is closed
and fixed by `ValueKind` in `contracts/values.ts`:

| Kind       | `ValueKind` | Description                                                  | Mutable? | Compared by         |
| ---------- | ----------- | ------------------------------------------------------------ | -------- | ------------------- |
| `null`     | `Null`      | The single unit value, denoting "no value".                  | —        | value (only `null`) |
| `boolean`  | `Boolean`   | `true` or `false`.                                           | no       | value               |
| `number`   | `Number`    | A 64-bit IEEE-754 double-precision float.                    | no       | value               |
| `string`   | `String`    | An immutable sequence of characters.                         | no       | value               |
| `array`    | `Array`     | An ordered, integer-indexed, heterogeneous, growable list.   | **yes**  | reference identity  |
| `object`   | `Object`    | A string-keyed, **insertion-ordered** map.                   | **yes**  | reference identity  |
| `function` | `Function`  | A user-defined function that closes over its defining scope. | —        | reference identity  |
| `builtin`  | `Builtin`   | A native function provided by the standard library.          | —        | reference identity  |

Klein is dynamically typed: a variable holds a value of any kind, and a value
carries its own kind at runtime. There is no static type checker (see
[Intentional non-goals](#intentional-non-goals)).

### `null`

`null` is the sole value of its kind. It is produced by the `null` literal, by a
`return;` with no operand, by a function that falls off its end without
returning, and by the standard library where a call has no meaningful result. It
is one of only two falsy values (see [Truthiness](#truthiness)).

### Booleans

`true` and `false` are the two boolean values. Boolean values are produced by the
`true`/`false` literals, by every comparison and equality operator, and by the
logical-not operator `!`.

### Numbers

All Klein numbers are IEEE-754 double-precision floats — there is a single
numeric type, with no separate integer type. Consequences of this choice, all
intentional:

- Integer-valued numbers print without a trailing `.0` (e.g. `3`, not `3.0`).
  The exact numeric rendering is fixed and owned by the runtime's value
  stringifier; this document fixes only the observable rule that integral values
  render without a fractional part.
- Arithmetic follows IEEE-754. In particular `NaN` is never equal to itself (see
  [Equality](#equality)).
- The usual double-precision limits on magnitude and integer exactness apply.

Numeric **literals** come in three forms:

| Form        | Examples                     |
| ----------- | ---------------------------- |
| Decimal     | `0`, `42`, `3.14`, `.5`      |
| Exponent    | `1e10`, `6.022e23`, `2.5e-3` |
| Hexadecimal | `0xFF`, `0x10`, `0xdead`     |

A malformed numeric literal is a lexical error (`InvalidNumber`, `E1004`).

### Strings

A string is an immutable sequence of characters written between double quotes.
The following escape sequences are recognized inside string literals:

| Escape   | Meaning                                        |
| -------- | ---------------------------------------------- |
| `\n`     | newline                                        |
| `\t`     | horizontal tab                                 |
| `\r`     | carriage return                                |
| `\\`     | backslash                                      |
| `\"`     | double quote                                   |
| `\0`     | the NUL character                              |
| `\uXXXX` | the Unicode code unit with 4 hex digits `XXXX` |

An unrecognized escape is a lexical error (`InvalidEscape`, `E1003`); a string
literal with no closing quote before end-of-line/end-of-input is
`UnterminatedString` (`E1002`). The `+` operator concatenates two strings (see
[Operators](#operators-precedence-and-associativity)).

### Arrays

An array is an ordered, zero-indexed, growable list that may hold values of any
kind, mixed freely. Arrays are **mutable reference values**: assigning an array
to another variable, passing it to a function, or storing it in an object shares
the _same_ array, and a mutation through any alias is visible through all of
them.

```klein
let xs = [1, "two", [3], true];
let ys = xs; // ys and xs refer to the same array
ys[0] = 99;
println(xs[0]); // 99
```

Elements are read and written with the index operator `a[i]` (see
[Indexing](#indexing-ai)). Growing and shrinking an array is done through
standard-library builtins rather than syntax.

### Objects

An object is a mutable map from **string keys** to values. Key order is
**insertion order** and is preserved — this is a guaranteed, observable property
of Klein objects, not an incidental one, which is why the runtime backs objects
with an ordered map rather than a plain host object. Objects are reference values
with the same aliasing semantics as arrays.

Object keys are always strings. In an object literal a key may be written as an
identifier or as a string literal; both denote the string key:

```klein
let user = { name: "Ada", "favorite color": "green" };
println(user.name); // Ada
println(user["favorite color"]); // green
user.age = 36; // adds a new key
```

Members are accessed with `.` (when the key is an identifier) or with `[...]`
(for any string key); see [Member access](#member-access-ok) and
[Indexing](#indexing-ai).

### Functions and builtins

A **function** value is a user-defined function paired with the environment it
closed over at definition time (its closure). A **builtin** value is a native
function provided by the standard library (for example `print`, `len`). Both are
first-class: they can be bound to variables, passed as arguments, returned from
functions, and stored in arrays and objects. Both compare by reference identity.
Functions and closures are specified in full under
[Functions and closures](#functions-and-closures).

---

## Bindings and scope

### `let` bindings

A variable is introduced with a `let` statement, which **must** have an
initializer:

```klein
let x = 10;
let name = "Klein";
let pair = [x, name];
```

`let` creates a **new binding in the current scope**. It is the only construct
that creates a variable binding; bare assignment does not (see
[Assignment as an expression](#assignment-as-an-expression)).

### Lexical block scope

Klein has lexical (static) scope. A **block** `{ ... }` introduces a new nested
scope whose parent is the enclosing scope. Name resolution walks the scope chain
outward from the innermost scope to the global scope; the global scope is where
the standard-library builtins live.

A binding is visible from its declaration to the end of the block that contains
it, including in nested blocks and in functions defined within that block.

### Shadowing

A `let` in an inner scope may reuse a name from an outer scope. The inner binding
**shadows** the outer one for the remainder of the inner scope; the outer binding
is untouched and becomes visible again when the inner scope ends.

```klein
let x = 1;
{
  let x = 2; // shadows the outer x within this block
  println(x); // 2
}
println(x); // 1
```

Re-declaring a name with `let` in the _same_ scope introduces a fresh binding for
that name from that point onward. (Whether a same-scope redeclaration is
diagnosed is an implementation-defined detail; see
[Deferred details](#deferred-and-implementation-defined-details).)

---

## Assignment as an expression

Assignment with `=` is an **expression**, not a statement — it evaluates to the
value assigned and can appear anywhere an expression is expected. This is fixed by
`AssignmentExpression` in `contracts/ast.ts`.

```klein
let x = 0;
let y = (x = 5); // x becomes 5; the assignment yields 5, so y is 5
println(x + y); // 10
```

Assignment is **right-associative**, so `a = b = c` parses as `a = (b = c)`: `c`
is evaluated once and assigned to `b`, and that value is then assigned to `a`.

### Assignment targets

The left-hand side of an assignment must be an **assignable location**. Fixed by
`AssignmentTarget` in `contracts/ast.ts`, exactly three forms are assignable:

| Target form       | Example    | Effect                                 |
| ----------------- | ---------- | -------------------------------------- |
| Identifier        | `x = v`    | Reassign the existing variable `x`.    |
| Index expression  | `a[i] = v` | Store `v` at index/key `i` of `a`.     |
| Member expression | `o.k = v`  | Store `v` under key `k` of object `o`. |

Any other left-hand side (for example `1 = x` or `f() = x`) is a **syntax error**
(`InvalidAssignmentTarget`, `E2004`), reported by the parser.

### Assignment to a variable does not create a binding

Assigning to a bare identifier reassigns an **existing** binding, searching
outward through the scope chain for it. If the name is not bound anywhere in the
chain, the assignment is a runtime error (`UndefinedVariable`, `E3001`). This is
the direct consequence of `Environment.assign` in `contracts/values.ts`, which
searches for an existing binding and throws when it finds none. To _introduce_ a
variable you must use `let`.

```klein
let count = 0;
count = count + 1; // OK: reassigns the existing binding
oops = 1; // runtime error E3001: `oops` was never declared with `let`
```

Index and member assignments (`a[i] = v`, `o.k = v`) instead mutate the target
container in place, following the indexing and member rules in
[Expressions](#expressions).

---

## Operators, precedence, and associativity

This section is the **authoritative precedence and associativity table** for
Klein. The grammar in [`GRAMMAR.md`](./GRAMMAR.md) mirrors this table verbatim;
if the two ever disagree, this table governs and the grammar is in error.

The operator set is closed and fixed by `contracts/ast.ts`: the binary operators
(`BinaryOperator`), the short-circuiting logical operators (`LogicalOperator`,
kept a distinct node kind precisely because they short-circuit), the unary
operators (`UnaryOperator`), assignment (`AssignmentExpression`), and the postfix
call/index/member forms.

Levels are numbered from **1 (binds loosest)** to **9 (binds tightest)**. A
higher level binds more tightly, so an operand between two operators of different
levels associates with the higher-numbered (tighter) one.

| Level | Category          | Operators             | Associativity  | Node kind              | Short-circuits? |
| ----- | ----------------- | --------------------- | -------------- | ---------------------- | --------------- |
| 1     | Assignment        | `=`                   | right          | `AssignmentExpression` | no              |
| 2     | Logical OR        | `\|\|`                | left           | `LogicalExpression`    | **yes**         |
| 3     | Logical AND       | `&&`                  | left           | `LogicalExpression`    | **yes**         |
| 4     | Equality          | `==` `!=`             | left           | `BinaryExpression`     | no              |
| 5     | Relational        | `<` `>` `<=` `>=`     | left           | `BinaryExpression`     | no              |
| 6     | Additive          | `+` `-`               | left           | `BinaryExpression`     | no              |
| 7     | Multiplicative    | `*` `/` `%`           | left           | `BinaryExpression`     | no              |
| 8     | Unary (prefix)    | `-` `!`               | right (prefix) | `UnaryExpression`      | n/a             |
| 9     | Postfix / primary | `f(...)` `a[i]` `o.k` | left           | see below              | n/a             |

At level 9, calls (`CallExpression`), indexing (`IndexExpression`), and member
access (`MemberExpression`) bind tightest and chain left-to-right, so
`o.a[i](x).b` parses as `((((o.a)[i])(x)).b)`. Below every operator sits the
**primary** level: literals, identifiers, a parenthesized expression `( ... )`,
an array literal, an object literal, and a function literal. Parentheses group
and override precedence but are not themselves an operator.

Worked examples of the table in action:

```klein
1 + 2 * 3         // 7   : * (7) binds tighter than + (6)
2 + 3 == 5        // true: + (6) binds tighter than == (4)
-2 * 3            // -6  : unary - (8) binds tighter than * (7)
a && b || c       // (a && b) || c : && (3) binds tighter than || (2)
x = y = 1         // x = (y = 1)   : assignment (1) is right-associative
!a == b           // (!a) == b     : unary ! (8) binds tighter than == (4)
```

### Arithmetic operators

`+` `-` `*` `/` `%` operate on **numbers** and produce a number, with `/` being
floating-point division and `%` the floating-point remainder. Additionally, `+`
**concatenates two strings** and produces a string. Division or remainder with a
zero divisor is a runtime error (`DivisionByZero`, `E3009`).

Applying an arithmetic operator to operands of the wrong kind — for example
adding a number to a boolean, or subtracting strings — is a runtime type error.
Klein performs **no implicit conversions** between kinds: `1 + "x"` is an error,
not `"1x"`. (The exact code raised for a bad operand, drawn from `TypeMismatch`
`E3002` and `InvalidOperand` `E3010`, is described under
[The error model](#the-error-model).)

### Relational operators

`<` `>` `<=` `>=` compare two **numbers** and produce a boolean, using IEEE-754
ordering. Whether ordered comparison is additionally defined for other kinds
(for example lexicographic ordering of strings) is not fixed by the contracts and
is left to the runtime; applying a relational operator to operands it does not
support is a runtime error. See
[Deferred details](#deferred-and-implementation-defined-details).

### Equality operators

`==` and `!=` are defined for **all** value kinds and never raise a type error;
their full semantics are specified under [Equality](#equality).

### Logical operators

`&&` and `||` **short-circuit**, which is exactly why the contract models them as
a distinct `LogicalExpression` node rather than a `BinaryExpression`:

- `a && b` evaluates `a`; if `a` is falsy it yields `a` **without evaluating
  `b`**; otherwise it evaluates and yields `b`.
- `a || b` evaluates `a`; if `a` is truthy it yields `a` **without evaluating
  `b`**; otherwise it evaluates and yields `b`.

"Falsy" and "truthy" are defined in [Truthiness](#truthiness). Note that `&&` and
`||` yield **one of their operand values** (not a coerced boolean), so
`0 || "x"` yields `"x"` and `1 && 2` yields `2`. Only `!` always yields a boolean.

### Unary operators

- `-x` negates a number. Applying it to a non-number is a runtime type error.
- `!x` yields `true` if `x` is falsy and `false` otherwise. `!` is defined for
  **every** value via truthiness and never raises a type error.

---

## Truthiness

Many constructs — `if`, `while`, the `for` condition, `&&`, `||`, and `!` — ask
whether a value is _truthy_. Klein's rule is deliberately minimal and total:

> **Only `null` and `false` are falsy. Every other value is truthy.**

In particular, all of the following are **truthy**: the number `0`, the empty
string `""`, the empty array `[]`, the empty object `{}`, every function, and
every builtin. There are no other falsy values and no per-kind exceptions. This
is a conscious design decision: the rule is easy to remember, has no surprising
edge cases (such as `0` or `""` being falsy), and makes conditionals predictable.

```klein
if (0) {
  println("zero is truthy"); // this runs
}
if ("") {
  println("empty string is truthy"); // this runs
}
if (null || false) {
  println("unreachable"); // neither branch value is truthy
}
```

---

## Equality

`==` and `!=` compare two values and always yield a boolean; they never raise a
type error. The rule depends on the kinds of the operands:

- **Primitives compare by value (structurally).** Two `null` values are equal.
  Two booleans are equal iff they are the same boolean. Two numbers are equal iff
  they are equal under IEEE-754 (so `NaN == NaN` is **false**, and `0 == 0`).
  Two strings are equal iff they contain the same characters.
- **Arrays, objects, functions, and builtins compare by reference identity.**
  Two such values are equal **only if they are the same object in memory** —
  never by comparing their contents. Two distinct arrays with identical elements
  are _not_ equal.
- **Different kinds are never equal.** Comparing values of two different kinds
  (for example a number and a string) yields `false` for `==` and `true` for
  `!=`. This is not an error.

`a != b` is defined as the logical negation of `a == b`.

```klein
1 == 1; // true  (number value)
"ab" == "ab"; // true  (string value)
[1] == [1]; // false (distinct arrays; reference identity)
let xs = [1];
xs == xs; // true  (same array)
1 == "1"; // false (different kinds; no coercion)
null == false; // false (different kinds)
```

The reference-identity rule for compound values is the same rule that governs
their aliasing (see [Arrays](#arrays) and [Objects](#objects)): identity, not
structure, is what `==` observes.

---

## Expressions

An expression produces a value. This section covers the expression forms not
already covered by [Operators](#operators-precedence-and-associativity); the
complete set of expression node kinds is fixed by the `Expression` union in
`contracts/ast.ts`.

### Literals

Number, string, boolean (`true`/`false`), and `null` literals evaluate to the
corresponding value, as described under [Values](#values).

### Array literals

`[e1, e2, ...]` evaluates each element expression left to right and produces a
fresh array value containing the results. An empty array is `[]`.

### Object literals

`{ k1: e1, "k2": e2, ... }` evaluates each value expression and produces a fresh
object with the given keys in the written order. A key is either an identifier
(`k1`) or a string literal (`"k2"`); both denote a string key. An empty object is
`{}`.

### Function literals

`fn(params) { body }` evaluates to a first-class function value that closes over
the current scope. Function literals are specified under
[Functions and closures](#functions-and-closures).

### Call `f(...)`

`f(a1, a2, ...)` evaluates the callee `f` and then each argument left to right,
and invokes the callee. The callee must be a function or a builtin; calling any
other kind of value is a runtime error (`NotCallable`, `E3003`). Argument-count
rules are given under [Functions and closures](#functions-and-closures).

### Indexing `a[i]`

`a[i]` evaluates `a` and then `i` and reads an element:

- On an **array**, `i` must be a number used as a zero-based index; an index
  outside the array's bounds is a runtime error (`IndexOutOfRange`, `E3005`), and
  a non-number index is `InvalidIndexType` (`E3007`).
- On an **object**, `i` must be a string naming a key.

Indexing a value that is neither an array nor an object is a runtime error
(`InvalidIndexTarget`, `E3006`). As an assignment target, `a[i] = v` stores `v`
at that position, mutating the container in place. (The precise behavior of an
object read for an absent key, and of string indexing, is implementation-defined;
see [Deferred details](#deferred-and-implementation-defined-details).)

### Member access `o.k`

`o.k` reads the value stored under the string key `"k"` of object `o`. It is
exactly equivalent to `o["k"]` except that the key is written as an identifier in
the source. Reading a key that is absent from the object is
`PropertyNotFound` (`E3008`); using `.` on a value that is not an object is
`InvalidIndexTarget` (`E3006`). As an assignment target, `o.k = v` sets the key,
adding it if it was not present.

---

## Control flow

Klein's control-flow statements are fixed by the `Statement` union in
`contracts/ast.ts`. All conditions are evaluated with the
[truthiness](#truthiness) rule.

### Statements and blocks

A program is a sequence of statements executed in order. A **block**
`{ stmt; stmt; ... }` groups statements and, as noted under
[scope](#lexical-block-scope), introduces a new lexical scope. Expression
statements are terminated with `;`.

### `if` / `else if` / `else`

```klein
if (cond) {
  // consequent
} else if (other) {
  // an alternate that is itself an if
} else {
  // final alternate
}
```

`if` evaluates its condition; if truthy it runs the consequent block, otherwise
it runs the alternate if present. The `else if` form is not a separate construct:
per `IfStatement` in `contracts/ast.ts`, an `else if` is simply an `if` whose
**alternate is itself an `if` statement**. The consequent and the final `else`
alternate are always blocks.

### `while`

```klein
while (cond) {
  // body
}
```

`while` re-evaluates its condition before each iteration and runs the body block
while the condition is truthy. `break` and `continue` apply (see below).

### `for`

Klein's `for` is the C-style three-clause loop; per `ForStatement` in
`contracts/ast.ts`, **all three clauses are optional**:

```klein
for (let i = 0; i < 10; i = i + 1) {
  println(i);
}
```

- The **init** clause, if present, is either a `let` binding or an expression
  statement, and runs once before the loop. A `let` here is scoped to the loop.
- The **condition**, if present, is checked before each iteration; the loop runs
  while it is truthy. An **omitted condition is treated as always true**, giving
  an infinite loop (exit with `break`).
- The **update**, if present, is an expression evaluated after each iteration.

`for (;;) { ... }` is thus a bare infinite loop. `break` and `continue` apply.

### `break` and `continue`

Within a `while` or `for` loop, `break` exits the nearest enclosing loop
immediately, and `continue` skips the rest of the current iteration and proceeds
to the loop's next step (the update clause, for a `for`). Both are only
meaningful inside a loop; using them outside any loop is rejected (the exact
diagnostic is implementation-defined; see
[Deferred details](#deferred-and-implementation-defined-details)).

### Result of a program

Running a program yields the value of its **final expression statement**, or
`null` if the program has none (per `Interpreter.run` in `contracts/values.ts`).
This is primarily observable in the REPL, which prints that value.

---

## Functions and closures

Functions are first-class values with lexical closure. Klein provides two ways to
create them, fixed by `FunctionDeclaration` and `FunctionLiteral` in
`contracts/ast.ts`.

### Declarations and expressions

A **function declaration** binds a named function in the current scope:

```klein
fn add(a, b) {
  return a + b;
}
```

A **function expression** (function literal) is anonymous and evaluates to a
function value, typically bound with `let` or passed inline:

```klein
let mul = fn(a, b) {
  return a * b;
};
map(xs, fn(x) {
  return x * 2;
});
```

Both forms are first-class: a function value can be stored, passed, returned, and
compared (by reference identity).

### Parameters and arguments

Parameters are named and positional. Declaring the same parameter name twice in
one parameter list is a syntax error (`DuplicateParameter`, `E2005`).

Calling a **user function** with the wrong number of arguments is a runtime error
(`WrongArgumentCount`, `E3004`). Calling a **builtin** with an argument count
outside its declared arity is likewise `WrongArgumentCount`; the interpreter
checks a builtin's arity _before_ invoking it, so a builtin never runs with the
wrong number of arguments. Calling a value that is neither a function nor a
builtin is `NotCallable` (`E3003`).

### `return`

`return expr;` ends the current function call and yields `expr`'s value.
`return;` with no operand yields `null`. A function that reaches the end of its
body without returning also yields `null`.

### Closures and lexical capture

A function value captures the environment in which it was **defined**, not the
one in which it is called (this is the `closure` field of `FunctionValue` in
`contracts/values.ts`). Free variables in the body resolve through that captured
scope chain, and because capture is by reference to the environment, a closure
observes later mutations to the variables it closed over:

```klein
fn make_adder(n) {
  return fn(x) {
    return x + n; // `n` is captured from make_adder's scope
  };
}
let add10 = make_adder(10);
println(add10(5)); // 15
```

### Recursion and hoisting

A named function declaration is **hoisted by value** within its enclosing block
(per the note on `FunctionDeclaration` in `contracts/ast.ts`): the name is bound
for the whole block, so a function can call **itself** recursively and can
reference sibling declarations in the same block regardless of textual order.

```klein
fn is_even(n) {
  if (n == 0) {
    return true;
  }
  return is_odd(n - 1); // forward reference to a sibling declaration
}
fn is_odd(n) {
  if (n == 0) {
    return false;
  }
  return is_even(n - 1);
}
```

Unbounded recursion is bounded by a maximum call depth; exceeding it is a runtime
error (`StackOverflow`, `E3012`). The limit is configurable
(`InterpreterOptions.maxCallDepth` in `contracts/values.ts`) and defaults to a
safe value.

### The standard library

A set of **builtin** functions (for example output and collection helpers) is
installed into the global scope before a program runs. Builtins are ordinary
callable values and follow the same call, arity, and error rules as user
functions. The concrete roster of builtins is defined by the standard library and
documented separately; this specification fixes only how builtins _behave as
values_, not which builtins exist.

---

## The error model

Excellent, structured diagnostics are a first-class feature of Klein, not an
afterthought. Every error Klein reports is **source-anchored** and carries a
stable machine-readable code. The shapes and vocabulary here are fixed by
`contracts/errors.ts`; tools and tests key off the **`ErrorCode`**, never off
human-readable message text (so messages may be reworded freely).

### Phases

Every error belongs to one of three **phases**, matching the pipeline stage that
detects it (`ErrorPhase` in `contracts/errors.ts`):

- **lexical** — raised while tokenizing (bad characters, malformed literals,
  unterminated strings/comments).
- **syntax** — raised while parsing (unexpected or missing tokens, invalid
  assignment targets, duplicate parameters).
- **runtime** — raised while evaluating (undefined variables, type mismatches,
  bad calls, out-of-range indexing, division by zero, and so on).

The lexer and parser are **error-tolerant**: each collects diagnostics and
recovers (the parser synchronizes to the next statement boundary), so one run
surfaces many lexical/syntax errors at once. The interpreter, by contrast,
**throws on the first runtime fault**; the top-level facade catches it and
reports it. The end-to-end `interpret()` facade never throws for a Klein-level
fault — it returns every error as a structured diagnostic
(`InterpretOutcome` in `contracts/pipeline.ts`).

### Diagnostic shape

Each diagnostic (`Diagnostic` in `contracts/errors.ts`) carries a `severity`, its
`phase`, its `ErrorCode`, a human-readable `message`, and the source `span` it
points at. **Runtime** diagnostics additionally carry a call `stack` (an array of
frames, innermost last), so a runtime failure shows the chain of calls that led
to it. Every error carries a span — no Klein error is ever raised without a
source location.

Diagnostics render as a multi-line, human-readable snippet with a caret
underline, in the form fixed by `contracts/errors.ts`:

```text
error[E3001]: undefined variable 'foo'
 --> script.kl:3:9
  |
3 |   let y = foo + 1;
  |           ^^^ not defined in this scope
```

### Error code catalogue

The following are the complete `ErrorCode` values fixed by `contracts/errors.ts`,
grouped by phase. Code strings are stable identifiers; the descriptions state
when each arises.

**Lexical (`E1xxx`)**

| Code    | Name                  | Raised when                                     |
| ------- | --------------------- | ----------------------------------------------- |
| `E1001` | `UnexpectedCharacter` | A character appears that begins no valid token. |
| `E1002` | `UnterminatedString`  | A string literal has no closing quote.          |
| `E1003` | `InvalidEscape`       | A string contains an unrecognized `\` escape.   |
| `E1004` | `InvalidNumber`       | A numeric literal is malformed.                 |
| `E1005` | `UnterminatedComment` | A block comment `/* ...` is never closed.       |

**Syntax (`E2xxx`)**

| Code    | Name                      | Raised when                                              |
| ------- | ------------------------- | -------------------------------------------------------- |
| `E2001` | `UnexpectedToken`         | A token appears where the grammar allows none.           |
| `E2002` | `ExpectedToken`           | A specifically required token (e.g. `)`, `;`) is absent. |
| `E2003` | `ExpectedExpression`      | An expression was required but none was found.           |
| `E2004` | `InvalidAssignmentTarget` | The left of `=` is not an assignable location.           |
| `E2005` | `DuplicateParameter`      | A parameter name is repeated in one parameter list.      |

**Runtime (`E3xxx`)**

| Code    | Name                 | Raised when                                                       |
| ------- | -------------------- | ----------------------------------------------------------------- |
| `E3001` | `UndefinedVariable`  | Reading or assigning a name bound nowhere in scope.               |
| `E3002` | `TypeMismatch`       | An operation receives a value of an unexpected kind.              |
| `E3003` | `NotCallable`        | Calling a value that is not a function or builtin.                |
| `E3004` | `WrongArgumentCount` | A call's argument count violates the callee's arity.              |
| `E3005` | `IndexOutOfRange`    | An array index is outside the array's bounds.                     |
| `E3006` | `InvalidIndexTarget` | Indexing or member-accessing a non-indexable value.               |
| `E3007` | `InvalidIndexType`   | Using an index of the wrong kind (e.g. a non-number on an array). |
| `E3008` | `PropertyNotFound`   | Reading an object key that is absent.                             |
| `E3009` | `DivisionByZero`     | The right operand of `/` or `%` is zero.                          |
| `E3010` | `InvalidOperand`     | An operator receives an operand it cannot act on.                 |
| `E3011` | `AssertionFailed`    | A standard-library assertion fails.                               |
| `E3012` | `StackOverflow`      | User-function call depth exceeds the configured maximum.          |
| `E3013` | `UserError`          | A program raises an error through the standard library.           |

The exact code chosen among the closely related type/operand codes (`E3002`
`TypeMismatch` vs. `E3010` `InvalidOperand`) for a given bad-operand situation,
and the precise triggering conditions of the indexing codes, are settled by the
runtime implementation; this catalogue fixes the codes, their phases, and their
meanings.

---

## Intentional non-goals

The following features are **deliberately absent** from Klein. They are design
decisions, not oversights or unfinished work: Klein is intentionally a small,
tree-walked language, and each omission keeps the semantics small enough to
specify exactly and implement without surprises. (This list mirrors the project
hub's out-of-scope declaration.)

- **No bytecode compiler or JIT.** Klein is executed by a tree-walking
  interpreter. For a language this small, a tree-walker wins on clarity and
  maintainability; a bytecode VM would add substantial machinery that the
  language does not need.
- **No module or import system.** A program is a single source unit. There is no
  `import`/`export` and no module resolution.
- **No garbage collector of Klein's own.** Klein values are host (JavaScript)
  objects and are reclaimed by the host runtime's garbage collector. Klein does
  not implement memory management.
- **No user-defined types or classes.** There is no `class`, no user-defined
  constructors, and no inheritance. Structured data is modeled with arrays and
  objects; behavior is modeled with functions and closures.
- **No async or concurrency.** There are no promises, `async`/`await`, threads,
  or coroutines. Evaluation is synchronous and single-threaded.
- **No package manager for Klein.** There is no Klein-level dependency or package
  ecosystem. (The interpreter itself ships as an npm package, which is a
  different thing.)
- **No static type checker for Klein programs.** Klein is dynamically typed by
  design; type errors surface at runtime as structured diagnostics rather than
  being caught ahead of time by a checker.

---

## Deferred and implementation-defined details

In keeping with this document's rule to expand only what the project hub and
`contracts/` fix, the following fine-grained points are **not** pinned down by
those sources. They are settled by the runtime implementation and, where
user-visible, by the standard library; they are recorded here so readers know
these are intentionally open in the specification rather than forgotten.

- **Ordered comparison of non-numbers.** `<` `>` `<=` `>=` are specified on
  numbers. Whether they additionally order strings (lexicographically) or any
  other kind is left to the runtime; applying them to unsupported operands is a
  runtime error.
- **Bad-operand code selection.** For an operator applied to an operand of the
  wrong kind, the choice between `TypeMismatch` (`E3002`) and `InvalidOperand`
  (`E3010`) is a runtime decision; the codes and their meanings are fixed, the
  exact assignment per situation is not.
- **Object read for an absent key via `[...]` vs `.`.** Member access `o.k` of an
  absent key is `PropertyNotFound` (`E3008`); whether `o["k"]` for an absent key
  behaves identically or yields `null` is implementation-defined.
- **String indexing.** Whether `s[i]` indexes into a string is not fixed here;
  string element and length access may be provided by the standard library
  instead. Consult the standard-library documentation.
- **`break`/`continue` outside a loop, and same-scope `let` redeclaration.**
  Whether these are rejected at parse time or at runtime, and with which code, is
  an implementation detail; the language rule (both are only meaningful as
  written) is fixed here.

Any program that stays within the behavior this document fixes will run
identically across conforming Klein implementations. These deferred points affect
only edge cases at the margins of the fixed semantics.
