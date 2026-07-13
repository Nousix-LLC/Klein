# Task: Documentation — README, language spec, grammar, license, changelog

**Slug**: `docs` · **Depends on**: `tooling` · **Dependents**: `verify`.

## Objective
Author the project's user- and contributor-facing documentation: what Klein is,
how to install/run it, the authoritative language specification, the formal EBNF
grammar, the license, and the changelog.

## Context
Part of the Klein `scaffold` subtree (see `../_GLOBAL.md`). You depend on `tooling`
so the README's install/quickstart/CLI-usage and package name/`bin` match the real
`package.json` rather than a guess. You document behavior that `contracts/` and the
project hub already fix — you are the authoritative narrative expansion, not the
inventor of new semantics. Do not contradict `../../_GLOBAL.md` §3 or `contracts/`.

## Inputs (read at start)
- `../_GLOBAL.md` — subtree scope, ownership (§7), success criteria (§9).
- `../../_GLOBAL.md` — §1 quality bar, §2 scope (in/out, incl. intentional debt),
  §3 the authoritative language summary you expand, §4 architecture, §7 conventions.
- `../../contracts/` — `tokens.ts` (token/keyword vocabulary), `ast.ts` (grammar
  productions to mirror), `errors.ts` (`ErrorCode` catalogue), `values.ts`,
  `pipeline.ts`. **Read-only**; cite them for accuracy.
- `../SUBTASK_tooling/package.json` (dependency output) — package name, `bin`,
  scripts, Node engine — so README instructions are exact.

## Owned outputs (exclusive — write ONLY these; all at project root `../../`)
- `README.md` — what Klein is; install; quickstart; running `.kl` files and the
  REPL; the npm scripts (from `tooling`'s `package.json`); contributing notes.
- `docs/LANGUAGE.md` — the full authoritative language spec expanding
  `../../_GLOBAL.md` §3: values, bindings/scope, operators & precedence, control
  flow, functions/closures, truthiness (only `null`/`false` falsy), equality
  semantics, comments, literals, and the error model (reference `ErrorCode`s).
- `docs/GRAMMAR.md` — the complete EBNF grammar, consistent with `contracts/ast.ts`
  productions and the operator-precedence table.
- `LICENSE` — MIT.
- `CHANGELOG.md` — Keep-a-Changelog style; initial `Unreleased`/`0.1.0` entry.

Write NOTHING under `src/`, `tests/`, or the `tooling` config set. Do not modify `contracts/`.

## Success criteria
- Docs are internally consistent and consistent with `../../_GLOBAL.md` §3 and
  `contracts/` (token names, `ErrorCode`s, operator set/precedence, truthiness,
  equality rules all match — no drift).
- README install/usage commands match the real `package.json` scripts and `bin`.
- `docs/GRAMMAR.md` EBNF covers every construct in §3 and every AST node in
  `contracts/ast.ts` (no orphan productions, no missing constructs).
- `npm run format:check` passes on Markdown if Prettier is configured to include it
  (follow whatever `tooling` set; do not fight the formatter).
- Out-of-scope items (bytecode/JIT, modules, GC, user types, async, static checker)
  are documented as **intentional** design decisions, not silent omissions.

## Constraints
- Documentation only — you introduce NO runtime behavior and MUST NOT invent
  semantics beyond what the hub/contracts fix. If you find a genuine gap or
  contradiction in the spec, document it explicitly and flag it in `COMPLETE.md`
  rather than papering over it.

## Notes
Re-run your own atomic-vs-decompose evaluation at dispatch. `docs/LANGUAGE.md` is a
substantial authoritative spec; if your reading finds the doc set warrants separate
atomic tasks (e.g. language spec vs. grammar vs. project docs), decompose — that
judgement is yours.
