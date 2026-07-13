# Integration & Verification — subtree hub (`_GLOBAL.md`)

**Subtree hub for `SUBTASK_integration`.** Shared, write-once context for the
three children of the integration task. Read this **plus** the project hub
`../_GLOBAL.md` **plus** your own `SUBTASK_*/_BRIEF.md`. Treat `../contracts/`
and every other task's owned subtree as **read-only ground truth**.

**Created**: 2026-07-13 · **Status**: Active (decomposed) · **Parent**: `integration` (synthesis hub of Klein).

---

## 1. Why this task decomposed

The `integration` brief (`./_BRIEF.md`) enumerates **three distinct concerns** over
**three distinct kinds of artifact**:

1. **Example programs + golden outputs** (`examples/**`) — authored test-data.
2. **End-to-end / error test harness** (`tests/integration/**`, `tests/errors/**`) — QA code.
3. **Mechanical integrity verification + synthesis** (`SYNTHESIS.md`) — a release-gate verdict.

These fire the kernel's Scope / enumerated-concerns, Output-size, Distinct-Concerns
and Single-Responsibility triggers. They form the canonical **precursor → transform →
synthesis** serial pipeline: examples must exist before the E2E tests can assert
against their goldens, and both must exist before the integrity gate can certify the
composed whole. Hence three atomic children in a serial chain:

```
SUBTASK_examples ─▶ SUBTASK_e2e_tests ─▶ SUBTASK_verification
   (examples/**)      (tests/integration, tests/errors)   (SYNTHESIS.md + integrity gate)
```

Everything upstream (`scaffold`→`lexer`→`parser`→`runtime`→`stdlib`→`cli`) is **complete
and real** on disk; these children verify and demonstrate — they add no new core functionality.

## 2. Ownership partition (stays inside `integration`'s manifest ownership)

`../contracts/_MANIFEST.yaml` assigns `integration` the paths `examples/**`,
`tests/integration/**`, `tests/errors/**`. The children partition that set exactly —
**no overlap, nothing outside it** — plus the synthesis record:

| Child | Owns (writes ONLY these) |
|---|---|
| `SUBTASK_examples` | `examples/**` |
| `SUBTASK_e2e_tests` | `tests/integration/**`, `tests/errors/**` |
| `SUBTASK_verification` | `SYNTHESIS.md` (at the integration workspace root: `SUBTASK_integration/SYNTHESIS.md`). Writes NO source/test/example files. |

Kernel scaffolding files (`SUBTASK_*/`, `_GLOBAL.md`, `_BRIEF.md`, `SUSPENSION.md`,
`SYNTHESIS.md`) are named-state, **not** project source — the `ownership_respected`
identity audits source/test/config artifacts, not this scaffolding.

## 3. THE SHARED EXAMPLE/GOLDEN CONTRACT (binding on `examples` and `e2e_tests`)

This is the interface between children 1 and 2. Both MUST honor it verbatim so the
E2E suite is data-driven and never hard-codes example specifics.

Under `examples/` (all paths relative to the project root `../`):

- `examples/<name>.kl` — the Klein program.
- `examples/<name>.out` — **golden stdout**: the exact bytes the program prints via
  `print`/`println`, captured with color **disabled**. May be empty.
- `examples/<name>.diag` — **golden rendered diagnostics** (present only for `error`
  examples): the exact stderr text of the rendered snippet+caret diagnostics, color
  **disabled** (`NO_COLOR`). Omitted/absent for `ok` examples.
- `examples/index.json` — the machine-readable manifest the E2E suite iterates:
  ```json
  [
    { "name": "fibonacci",       "kind": "ok" },
    { "name": "errors_undefined", "kind": "error", "expectedCodes": ["E3001"] }
  ]
  ```
  - `name` matches the `<name>` stem of the `.kl`/`.out`/`.diag` files.
  - `kind` is `"ok"` (runs clean, exit 0, no diagnostics) or `"error"` (produces one
    or more diagnostics).
  - `expectedCodes` (REQUIRED for `kind:"error"`) is the ordered list of
    `ErrorCode` **string values** (e.g. `"E3001"` — see `../contracts/errors.ts`)
    the run must emit, in source order. Tests key off these codes, **never** on
    message text.
- `examples/README.md` — a short human index of the examples and what each demonstrates.

**Goldens are GENERATED, never hand-authored.** The `examples` child MUST produce every
`.out`/`.diag` by actually running the program through the real interpreter (see §4),
so a golden can never disagree with real behavior. The `e2e_tests` child then asserts
real runs still match the committed goldens.

## 4. How to run Klein (authoritative, from the completed `cli` stage)

- **Library facade** — `interpret(source, options)` from `../src/index.ts` returns
  `InterpretOutcome { ok, value, diagnostics }` and **never throws** for Klein-level
  faults. Program `print`/`println` output goes to `options.write(text)`; pass a
  capturing sink for deterministic goldens. Set nothing color-related here — the facade
  emits no color; rendering is separate.
- **Rendered diagnostics** — `formatDiagnostic(diagnostic, source, { color:false })`
  from `../src/core` (re-exported via `@core`) renders the multi-line snippet + `^`
  caret + `--> name:line:col` location. Use `color:false` for stable goldens.
- **Real executable** — `node ../bin/klein.mjs <file.kl>` runs a file end-to-end
  (via `tsx`), printing program output to **stdout**, rendered diagnostics to
  **stderr**, exit code `0` ok / `1` diagnostics / `2` usage-or-I/O. Honors `NO_COLOR`.
- **Output model reminder**: Klein programs emit output ONLY through the `print`/
  `println` builtins. The CLI does **not** echo a program's final value. Every example
  that should show output MUST call `print`/`println`.
- **Available builtins are whatever `../src/stdlib/registry.ts` actually registers.**
  The `examples` child MUST read `../src/stdlib/**` and use ONLY real builtins — do not
  assume `map`/`filter`/`reduce`/`len`/`push` etc. exist until confirmed there.
- **Determinism**: object key order = insertion order; integers print without a
  trailing `.0` (the `runtime` value-stringifier is authoritative).

## 5. Cross-cutting conventions (inherited — binding on all three children)

From `../_GLOBAL.md §7`: TypeScript strict, ESM `NodeNext`, Node ≥ 18; test runner
**Vitest**; **ESLint** + **Prettier** must stay green (new test files are linted and
format-checked too — write them clean). No `any` in exported signatures. Tests key off
`ErrorCode`, never message text. One responsibility per module; match the style of the
existing `../tests/**` suites (import from the public `../../src/index` where a suite is
exercising the public surface).

## 6. Methodology gap (inherited)

The engine software-methodology bundle is unavailable in this deployment
(`agent_domain_unset`). Methodology is encoded in `../contracts/`, `../_GLOBAL.md`, this
hub, and the briefs. A child dispatched WITH the bundle available SHOULD load it via
`methodology_glob`/`load_methodology` and reconcile; nothing here should contradict
standard interpreter integration/verification practice.

## 7. Child task summary

| Child (slug) | Responsibility | Depends on | Owned output |
|---|---|---|---|
| `SUBTASK_examples` | Author `examples/*.kl` + generated goldens + `index.json` | — (upstream `cli` already COMPLETED; runnable now) | `examples/**` |
| `SUBTASK_e2e_tests` | Data-driven E2E + error tests over the examples | `SUBTASK_examples` | `tests/integration/**`, `tests/errors/**` |
| `SUBTASK_verification` | Run all `_MANIFEST.yaml` identities; author `SYNTHESIS.md`; report failures precisely (no silent patching) | `SUBTASK_e2e_tests` | `SYNTHESIS.md` |

## 8. Success criteria (subtree-level)

- [ ] `examples/` holds a curated, idiomatic set with generated `.out`/`.diag` goldens and a valid `index.json`.
- [ ] Every example runs via the real interpreter and matches its golden; error examples emit exactly their `expectedCodes`.
- [ ] `tests/integration/**` + `tests/errors/**` are green, data-driven from `index.json`, and include at least one true-process (`bin/klein.mjs`) smoke test.
- [ ] All `_MANIFEST.yaml` identities pass — or are reported precisely as failures with the responsible task named — and `SYNTHESIS.md` gives a self-contained GO/NO-GO account of the delivered interpreter.
