# COMPLETE — `scaffold.core.diagnostic` (Klein diagnostic renderer)

**Task**: Implement the `DiagnosticFormatter` contract — render a structured
`Diagnostic` + its source text into Klein's human-readable, source-anchored
snippet + caret layout — plus exact-output unit tests. **Decompose evaluation**:
Atomic (one cohesive responsibility: Diagnostic → string rendering). **Status**:
COMPLETED. Every claim below was **proven by running the real command** on Node
v24.18.0, not asserted.

---

## 1. Owned outputs (exactly the two declared paths; nothing else touched)

| File | Role |
|---|---|
| `src/core/diagnostic.ts` | `DiagnosticFmt implements DiagnosticFormatter`, plus a shared `diagnosticFormatter` instance and a `formatDiagnostic(...)` free function. |
| `tests/core/diagnostic.test.ts` | 14 Vitest cases asserting the **exact** rendered bytes (colorless) + ANSI behaviour. |

`contracts/` unmodified; no config/docs/sibling files written; nothing outside the
two paths above.

## 2. Proof the gate is green (commands actually run)

```
npm run build        -> exit 0   (tsc -p tsconfig.build.json, strict, no `any`)
npm run lint         -> exit 0   (eslint .)
npm run format:check -> exit 0   (prettier --check .)
npm test             -> exit 0   (vitest run — 28 tests: 14 diagnostic + 14 span)
npm run coverage     -> exit 0   (thresholds enforced; see §3)
```

## 3. Coverage on `src/core/diagnostic.ts` (≥90% bar cleared)

```
diagnostic.ts | %Stmts 100 | %Branch 91.42 | %Funcs 100 | %Lines 100
```

Statements/lines/functions 100%; branch 91.42% (> 90% threshold — `npm run
coverage` exits 0). The three residual uncovered branches are unreachable
defensive fallbacks (`sourceLines[i] ?? ""` where `i` is always in range under a
`noUncheckedIndexedAccess`-forced guard, and the two `paint()` colour arms that a
single call cannot take both of) — left in place for safety rather than deleted to
game the metric.

## 4. What was implemented (against the `@contracts` surface, imported literally)

Renders the exact rustc-style layout from the `DiagnosticFormatter` docstring:

```
error[E3001]: undefined variable 'foo'
 --> script.kl:2:9
  |
2 | let y = foo + 1;
  |         ^^^
```

- **Header** `severity[CODE]: message` — severity-aware (`error`/`warning`).
- **Locator** `<pad>--> source:line:col` from `span.start`.
- **Gutter** line numbers right-aligned to the widest line number shown; ` | `
  separator; every pipe aligns at column `gutterW + 1`.
- **Snippet + caret** — a `^` run under the span columns (≥1 caret; clamped to line
  length), one caret line per covered source line.
- **Multi-line spans** — start line underlined from `start.column` to EOL; interior
  lines underlined fully; last line from column 1 to `end.column`; half-open
  `[start, end)` handled (an end at column 1 backs off to the prior line).
- **Runtime stack** — optional trailing frames when `diagnostic.stack` is present,
  labelled "innermost last" per the contract's ordering.
- **Colour** — `options.color` gates ANSI SGR codes (bold red/yellow severity +
  carets, bold blue gutter/locator); **off by default**, and stripping the ANSI
  sequences recovers the byte-identical colourless layout (asserted in tests).
- **Defensive** — out-of-range / empty / zero-width / malformed (end-before-start)
  spans render a sensible result and never throw (each covered by a test).

Column math is 1-based, UTF-16 code units (per `Position`). No `any` in the public
surface; `DiagnosticFmt.format` is structurally assignable to the contract method.

## 5. One documented design decision (per the subtree's "prefer boring, document it")

The `Diagnostic` contract exposes a **single `message`**, placed in the header. The
docstring's illustrative caret label (`^^^ not defined in this scope`) is a *second,
distinct* string with no corresponding field in the contract; rather than
confabulate one, the caret is left unlabelled and the message lives in the header.
The **structural** layout (header / locator / gutter / snippet / caret) matches the
contract exactly. Tests key off `ErrorCode` + structure and assert bytes for
diagnostics they construct, never on incidental message wording.

## 6. Conventions followed (from `tooling/COMPLETE.md` §5 + hub §4–5)

Extensionless relative import for the module-under-test; `@contracts` alias for
contract types (imported literally, never re-declared); explicit Vitest API import
(no globals); strict/`no-explicit-any`/exhaustive-switch all honoured.

## 7. Handoff to `scaffold.core.synthesis`

`diagnostic.ts` exports `DiagnosticFmt`, `diagnosticFormatter`, `formatDiagnostic`,
and `RenderOptions` for the `src/core/index.ts` barrel to re-export. It is
independent of `span`/`errors` (depends only on `contracts/`), so it composes
cleanly. Coverage on this module already exceeds the subtree's ≥90% bar.

## 8. Environment note

The engine software-methodology bundle was unreachable this invocation
(`agent_domain_unset` on `methodology_glob`/`load_methodology`) — the same gap the
hub `_GLOBAL.md` §9 records. Methodology was taken from `contracts/`, the ancestor
hubs, and `tooling/COMPLETE.md`, which fully specify this well-trodden task. Node is
provided via nvm (v24.18.0), matching the toolchain `tooling` proved against.
