/**
 * Tests for the interactive REPL (`startRepl`).
 *
 * The REPL is driven end-to-end through the **real** pipeline (lexer → parser →
 * interpreter + the real stdlib), exactly as `bin/klein.mjs` will drive it — only
 * the I/O is faked. A tiny scripted {@link ReplIo} feeds queued input lines and
 * captures everything written to stdout/stderr, so a whole session is
 * deterministic and assertions key off structured `ErrorCode`s (never
 * human-readable message text) per the project quality bar.
 */

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@contracts";

import { startRepl, type ReplIo } from "../../src/cli/repl";

// ─────────────────────────────────────────────────────────────────────────────
// Scripted-session harness
// ─────────────────────────────────────────────────────────────────────────────

interface Session {
  readonly io: ReplIo;
  /** Everything written to stdout, concatenated. */
  readonly out: () => string;
  /** Everything written to stderr, concatenated. */
  readonly err: () => string;
}

/**
 * Build a scripted session: `lines` are delivered in order by `nextLine()`, then
 * `null` (end-of-input). stdout/stderr are captured verbatim.
 */
function session(
  lines: readonly string[],
  opts?: { color?: boolean },
): Session {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const queue = [...lines];

  const io: ReplIo = {
    stdout: (text: string): void => {
      outChunks.push(text);
    },
    stderr: (text: string): void => {
      errChunks.push(text);
    },
    nextLine: (): Promise<string | null> =>
      Promise.resolve(queue.length > 0 ? (queue.shift() as string) : null),
    // Only set `color` when asked (exactOptionalPropertyTypes forbids `undefined`).
    ...(opts?.color === undefined ? {} : { color: opts.color }),
  };

  return {
    io,
    out: () => outChunks.join(""),
    err: () => errChunks.join(""),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent state across entries
// ─────────────────────────────────────────────────────────────────────────────

describe("startRepl — persistent global state", () => {
  it("shares a binding defined on one line with a later line", async () => {
    const s = session(["let x = 1;", "x + 1;", ".exit"]);

    await startRepl(s.io);

    // `x + 1;` evaluates against the persisted `x` and echoes 2.
    expect(s.out()).toContain("2\n");
    expect(s.err()).toBe("");
  });

  it("persists a reassignment across entries", async () => {
    const s = session(["let n = 10;", "n = n * 2;", "n;", ".exit"]);

    await startRepl(s.io);

    // `n = n * 2` is an assignment expression → echoes 20; `n;` echoes 20 again.
    const out = s.out();
    expect(out).toContain("20\n");
    // Two distinct echoes of 20 (the assignment result and the read).
    expect(out.match(/20\n/g)?.length).toBe(2);
  });

  it("persists a function declaration for use in a later entry", async () => {
    const s = session([
      "fn double(v) { return v * 2; }",
      "double(21);",
      ".exit",
    ]);

    await startRepl(s.io);

    expect(s.out()).toContain("42\n");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiline continuation
// ─────────────────────────────────────────────────────────────────────────────

describe("startRepl — multiline continuation", () => {
  it("assembles an unbalanced array literal across lines then evaluates it", async () => {
    const s = session(["let a = [", "1, 2,", "3];", "a[2];", ".exit"]);

    await startRepl(s.io);

    // The continuation prompt appears while the entry is unbalanced.
    expect(s.out()).toContain("...");
    // The reassembled entry defines `a`; `a[2]` echoes 3.
    expect(s.out()).toContain("3\n");
    expect(s.err()).toBe("");
  });

  it("continues across an unbalanced function body then runs it", async () => {
    const s = session([
      "fn add(x, y) {",
      "  return x + y;",
      "}",
      "add(2, 3);",
      ".exit",
    ]);

    await startRepl(s.io);

    expect(s.out()).toContain("5\n");
  });

  it("reports an unterminated string as an error rather than hanging (strings are single-line)", async () => {
    // Klein strings cannot span newlines, so an open quote is a real lexical
    // error, NOT a continuation. The REPL must surface it and keep going — never
    // wait forever for a close that can never arrive on a later line.
    const s = session(['let msg = "oops', "42;", ".exit"]);

    await startRepl(s.io);

    expect(s.err()).toContain(ErrorCode.UnterminatedString);
    // The session survived: the next entry still evaluates.
    expect(s.out()).toContain("42\n");
  });

  it("keeps reading while a block comment is left open", async () => {
    const s = session(["/* still", "going */ 7;", ".exit"]);

    await startRepl(s.io);

    expect(s.out()).toContain("...");
    expect(s.out()).toContain("7\n");
  });

  it("treats an unmatched closing bracket as a completed (erroring) entry, not a continuation", async () => {
    // A stray `}` can never be balanced by reading more, so it is evaluated
    // immediately and reported — the REPL must not wait on it.
    const s = session(["}", "1 + 1;", ".exit"]);

    await startRepl(s.io);

    // A syntax diagnostic was emitted (phase-2 codes are E2xxx)…
    expect(s.err()).toMatch(/E2\d{3}/);
    // …and the session continued to the next entry.
    expect(s.out()).toContain("2\n");
  });

  it("cancels an in-progress multiline entry on a blank continuation line", async () => {
    // Open a brace, then submit a blank line to cancel; the follow-up entry runs
    // normally, proving the buffer was discarded (no leftover `{`).
    const s = session(["fn stuck() {", "", "1 + 1;", ".exit"]);

    await startRepl(s.io);

    expect(s.out()).toContain("2\n");
    // The cancelled entry produced no diagnostic.
    expect(s.err()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-fatal error rendering (the session survives)
// ─────────────────────────────────────────────────────────────────────────────

describe("startRepl — errors do not end the session", () => {
  it("renders a runtime error and continues to the next entry", async () => {
    const s = session(["missing;", "1 + 1;", ".exit"]);

    await startRepl(s.io);

    // Undefined-variable diagnostic to stderr, keyed off the structured code…
    expect(s.err()).toContain(ErrorCode.UndefinedVariable);
    // …and the session survives: the next entry still evaluates.
    expect(s.out()).toContain("2\n");
  });

  it("renders a lexical error and continues", async () => {
    const s = session(["@", "7;", ".exit"]);

    await startRepl(s.io);

    expect(s.err()).toContain(ErrorCode.UnexpectedCharacter);
    expect(s.out()).toContain("7\n");
  });

  it("renders a syntax error and continues", async () => {
    const s = session(["let bad = + 1;", "8;", ".exit"]);

    await startRepl(s.io);

    expect(s.err()).toContain(ErrorCode.ExpectedExpression);
    expect(s.out()).toContain("8\n");
  });

  it("does not echo a value for an entry that errored", async () => {
    const s = session(["1 / 0;", ".exit"]);

    await startRepl(s.io);

    expect(s.err()).toContain(ErrorCode.DivisionByZero);
    // No stray value echo followed the diagnostic (nothing but prompts on stdout).
    expect(s.out()).not.toMatch(/\d\n/);
  });

  it("renders a runtime diagnostic with a call stack (innermost frame present)", async () => {
    const s = session(["missing;", ".exit"]);

    await startRepl(s.io);

    // The runtime renderer emits a traceback for runtime faults.
    expect(s.err()).toContain(ErrorCode.UndefinedVariable);
    expect(s.err()).toContain("traceback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Result echoing (suppress null, print meaningful values)
// ─────────────────────────────────────────────────────────────────────────────

describe("startRepl — result echoing", () => {
  it("routes print/println output through stdout and suppresses their null result", async () => {
    const s = session(['println("hello");', ".exit"]);

    await startRepl(s.io);

    // The builtin wrote "hello\n"; the call's null return is NOT echoed.
    expect(s.out()).toContain("hello\n");
    expect(s.out()).not.toContain("null");
  });

  it("does not echo anything for a declaration (null result suppressed)", async () => {
    const s = session(["let quiet = 99;", ".exit"]);

    await startRepl(s.io);

    // No echo — a `let` produces null, which is suppressed.
    expect(s.out()).not.toContain("99");
    expect(s.out()).not.toContain("null");
  });

  it("echoes a non-null string result raw (via the runtime stringifier)", async () => {
    const s = session(['"hi";', ".exit"]);

    await startRepl(s.io);

    // Top-level strings render raw (no quotes), matching `stringify`.
    expect(s.out()).toContain("hi\n");
  });

  it("echoes a collection result using the canonical stringifier", async () => {
    const s = session(["[1, 2, 3];", ".exit"]);

    await startRepl(s.io);

    expect(s.out()).toContain("[1, 2, 3]\n");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta-commands & session termination
// ─────────────────────────────────────────────────────────────────────────────

describe("startRepl — meta-commands and termination", () => {
  it("prints usage on .help and keeps running", async () => {
    const s = session([".help", "1 + 1;", ".exit"]);

    await startRepl(s.io);

    expect(s.out()).toContain(".help");
    expect(s.out()).toContain(".exit");
    // Still running after help: the next entry evaluates.
    expect(s.out()).toContain("2\n");
  });

  it("ends the loop on .exit and ignores anything after it", async () => {
    const s = session([".exit", "1 + 1;"]);

    await startRepl(s.io);

    // The post-.exit line must never be evaluated.
    expect(s.out()).not.toContain("2\n");
  });

  it("ends the session cleanly at end-of-input (no .exit needed)", async () => {
    const s = session(["let a = 5;"]);

    // Resolves without hanging even though the script never sends ".exit".
    await expect(startRepl(s.io)).resolves.toBeUndefined();
  });

  it("prints the banner once at startup", async () => {
    const s = session([".exit"]);

    await startRepl(s.io);

    expect(s.out()).toContain("Klein REPL");
    expect(s.out()).toContain("klein> ");
  });

  it("recognizes meta-commands only at entry start, not mid-continuation", async () => {
    // `.exit` arrives while a '(' is still open, so it is continuation content —
    // NOT the quit command. We then cancel with a blank line and run a real entry,
    // proving the session did not quit at the mid-continuation ".exit".
    const s = session(["(", ".exit", "", "1 + 1;", ".exit"]);

    await startRepl(s.io);

    // The session survived past the mid-continuation ".exit" and evaluated later.
    expect(s.out()).toContain("2\n");
    // The cancelled "( .exit" buffer was discarded — no diagnostic emitted.
    expect(s.err()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Colour option
// ─────────────────────────────────────────────────────────────────────────────

describe("startRepl — colour option", () => {
  it("emits ANSI colour in diagnostics when color is enabled", async () => {
    const s = session(["missing;", ".exit"], { color: true });

    await startRepl(s.io);

    // An ANSI SGR escape is present in the coloured diagnostic.
    // eslint-disable-next-line no-control-regex
    expect(s.err()).toMatch(/\x1b\[/);
  });

  it("emits no ANSI colour by default", async () => {
    const s = session(["missing;", ".exit"]);

    await startRepl(s.io);

    // eslint-disable-next-line no-control-regex
    expect(s.err()).not.toMatch(/\x1b\[/);
  });
});
