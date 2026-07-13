# Changelog

All notable changes to Klein are documented in this file.

The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet. Changes land here before being cut into a release.

## [0.1.0] - 2026-07-13

Initial release scope. Klein is a small, dynamically-typed language with a
tree-walking interpreter implemented in strict TypeScript for Node.js.

### Added

- **Language.** A dynamically-typed language with `null`, booleans, IEEE-754
  numbers, strings, mutable arrays, insertion-ordered objects, and first-class
  functions that close over their defining scope.
- **Bindings & operators.** `let` bindings with lexical block scope and
  shadowing; assignment as an expression; arithmetic `+ - * / %` (`+` also
  concatenates strings); comparisons `< > <= >= == !=`; short-circuiting
  logical `&& || !`; unary `- !`; indexing `a[i]`, member `o.k`, and call
  `f(x)`.
- **Control flow.** `if` / `else if` / `else`, `while`, C-style
  `for (init; cond; update)`, plus `break` and `continue`.
- **Predictable semantics.** Only `null` and `false` are falsy (`0` and `""`
  are truthy); `==` / `!=` are structural for primitives and reference-identity
  for arrays, objects, and functions.
- **Interpreter pipeline.** An error-tolerant lexer and Pratt parser that
  collect and recover from multiple diagnostics per run, and a tree-walking
  evaluator with lexical closures.
- **Diagnostics.** Every lexical, syntax, and runtime error is source-anchored
  with a line/column span, a rendered snippet with a caret underline, a stable
  `ErrorCode`, and — for runtime errors — a call stack.
- **Tooling.** Strict `tsc`, ESLint (typescript-eslint), Prettier, and Vitest,
  wired through the npm scripts documented in the README.
- **Documentation.** A README, the authoritative language specification
  (`docs/LANGUAGE.md`), and a formal EBNF grammar (`docs/GRAMMAR.md`).

### Notes

- The published CLI entry point (`bin/klein.mjs`) and its npm-install/run
  workflow are finalized as part of the CLI stage; see the README for the
  current developer flow.
