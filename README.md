# Klein

**Klein** is a small, dynamically-typed programming language with a
tree-walking interpreter written in strict TypeScript for Node.js.

It is deliberately small but genuinely usable: lexical closures, first-class
functions, arrays and objects, C-style control flow, and — as a first-class
feature — excellent, source-anchored error diagnostics. The implementation
favors the boring, correct choice (a tree-walker, not a bytecode VM) so the
code stays clear and maintainable.

The full language reference lives in [`docs/LANGUAGE.md`](docs/LANGUAGE.md) and
the formal grammar in [`docs/GRAMMAR.md`](docs/GRAMMAR.md). This README is the
front door: what Klein is, how to run it, and how to contribute.

## A taste of Klein

Comments of the form `// => value` below show what each expression evaluates
to.

```kl
// closures, arrays, objects, and control flow in Klein.

fn makeCounter(start) {
  let n = start;
  // The returned function closes over `n`.
  return fn() {
    n = n + 1;
    return n;
  };
}

let next = makeCounter(10);
next(); // => 11
next(); // => 12

// Only `null` and `false` are falsy, so `0` and "" are truthy values.
let chosen = 0 || "fallback"; // => 0  (0 is truthy, so || short-circuits)

let nums = [1, 2, 3, 4];
let total = 0;
for (let i = 0; i < 4; i = i + 1) {
  total = total + nums[i];
}
total; // => 10

let user = { name: "Ada", langs: ["Klein", "TS"] };
user.name + " writes " + user.langs[0]; // => "Ada writes Klein"
```

## Language at a glance

A quick summary; see [`docs/LANGUAGE.md`](docs/LANGUAGE.md) for the
authoritative details and [`docs/GRAMMAR.md`](docs/GRAMMAR.md) for the EBNF.

- **Values:** `null`, booleans, numbers (IEEE-754 double), strings, mutable
  arrays, insertion-ordered objects, and functions (closures).
- **Bindings:** `let x = expr;` with lexical block scope and shadowing;
  assignment `x = expr` is itself an expression.
- **Operators:** `+ - * / %` (with `+` also concatenating strings),
  comparisons `< > <= >= == !=`, short-circuiting logical `&& || !`, unary
  `-` / `!`, indexing `a[i]`, member access `o.k`, and calls `f(x)`.
- **Control flow:** `if` / `else if` / `else`, `while`, C-style
  `for (init; cond; update)`, `break`, and `continue`.
- **Functions:** `fn name(a, b) { ... }` declarations and `fn(a, b) { ... }`
  expressions; first-class and closing over their defining scope; values are
  returned with `return`.
- **Truthiness:** only `null` and `false` are falsy — everything else,
  including `0` and `""`, is truthy.
- **Equality:** `==` / `!=` are structural for primitives and compare arrays,
  objects, and functions by reference identity.
- **Comments:** `//` line comments and `/* ... */` block comments (block
  comments do not nest).

Klein also ships a small standard library of builtin functions; the available
builtins are documented in [`docs/LANGUAGE.md`](docs/LANGUAGE.md).

## Requirements

- **Node.js `>=18.18.0`** (Klein is an ESM package: `"type": "module"`).

## Running Klein

Once Klein is published, the intended workflow is to run a `.kl` file directly:

```console
klein path/to/program.kl
```

or start the REPL by launching `klein` with no arguments:

```console
klein
```

> **Note.** The published CLI entry point (`bin/klein.mjs`) and the
> npm-install/run workflow are authored and finalized by the CLI/publish stage
> of the project; they may not be wired up in an early checkout. Until then,
> use the developer flow below. This README describes the intended interface
> rather than asserting a run mechanism that has not yet been proven.

### Developing Klein locally

Clone the repository and install dependencies:

```console
npm install
```

Then use the npm scripts to build, test, and lint:

```console
npm run build       # type-check and emit with tsc
npm test            # run the test suite with Vitest
npm run lint        # ESLint
npm run format:check # verify Prettier formatting
```

## Diagnostics

Good error messages are a product feature in Klein, not an afterthought. Every
lexical, syntax, and runtime error is source-anchored with a line/column span,
a stable machine-readable `ErrorCode`, a rendered source snippet with a caret
underline, and — for runtime errors — a call stack. For example:

```text
error[E3001]: undefined variable 'foo'
 --> script.kl:3:9
  |
3 |   let y = foo + 1;
  |           ^^^ not defined in this scope
```

The lexer and parser collect and recover from errors, so a single run can
report many diagnostics at once rather than stopping at the first. Error codes
are stable and grouped by phase (`E1xxx` lexical, `E2xxx` syntax, `E3xxx`
runtime); the complete list is documented in
[`docs/LANGUAGE.md`](docs/LANGUAGE.md).

## npm scripts

The scripts defined in `package.json`:

| Script         | Command                         | Purpose                               |
| -------------- | ------------------------------- | ------------------------------------- |
| `build`        | `tsc -p tsconfig.build.json`    | Type-check and emit the build output. |
| `typecheck`    | `tsc -p tsconfig.json --noEmit` | Type-check without emitting.          |
| `lint`         | `eslint .`                      | Lint the project with ESLint.         |
| `lint:fix`     | `eslint . --fix`                | Lint and auto-fix where possible.     |
| `format`       | `prettier --write .`            | Format the project with Prettier.     |
| `format:check` | `prettier --check .`            | Verify formatting without writing.    |
| `test`         | `vitest run`                    | Run the test suite once.              |
| `test:watch`   | `vitest`                        | Run tests in watch mode.              |
| `coverage`     | `vitest run --coverage`         | Run tests and report coverage.        |

## Project layout

```text
klein/
├── src/
│   ├── core/      shared span/error/diagnostic helpers
│   ├── lexer/     source -> Token[]
│   ├── parser/    Token[] -> AST (Pratt parser)
│   ├── runtime/   AST -> Value (environments, closures, control flow)
│   ├── stdlib/    builtin functions
│   └── cli/       the CLI and REPL
├── contracts/     read-only interface schema shared by every stage
├── docs/          LANGUAGE.md and GRAMMAR.md
├── tests/         unit and integration tests
└── bin/           the published CLI entry point
```

`contracts/` is the machine-verifiable interface layer (token, AST, value, and
error shapes) that every stage composes against; it is treated as read-only
ground truth by the implementation.

## Contributing

Klein aims for a production-grade engineering bar. Contributions should keep it
there:

- **Strict, typed, ESM.** TypeScript strict mode with `NodeNext` modules; no
  `any` in exported signatures. Prefer discriminated unions with exhaustive
  `switch` statements.
- **The quality gate must stay green.** Before opening a change, run:

  ```console
  npm run typecheck
  npm run lint
  npm run format:check
  npm test
  ```

  The test suite targets at least 90% line coverage on `src/`.

- **Tests key off `ErrorCode`, not message text.** Assert on the structured
  code (for example `E3001`) rather than the human-readable message, so
  messages can be reworded without breaking tests.
- **One responsibility per module.** Each subtree exposes a barrel `index.ts`,
  and every error carries a source `Span`.
- **Formatting is enforced.** Prettier governs formatting; `README.md`,
  `CHANGELOG.md`, and the files under `docs/` are all checked by
  `npm run format:check`.

## Intentional non-goals

Klein is intentionally small. The following are deliberate design decisions,
not missing features, and are out of scope by choice:

- bytecode / JIT compilation (Klein is a tree-walking interpreter);
- a module / import system;
- a garbage collector (Klein relies on the JavaScript host's GC);
- user-defined types or classes;
- async / concurrency;
- a package manager for Klein;
- a static type checker for Klein programs.

## License

Klein is released under the [MIT License](LICENSE). Copyright (c) 2026 The
Klein Project.
