/**
 * Tests for the entry-point dispatch (`main`, `src/cli/main.ts`).
 *
 * `main` is the one seam that decides whether a `klein` invocation resolves to
 * the interactive REPL or the file runner. It is a **pure, injectable** async
 * function — it takes an argv vector and a {@link MainIo} and returns a process
 * exit code, touching no real `process` / `fs` (that is `bin/klein.mjs`'s job).
 * Every test drives it through a captured fake `MainIo` and asserts the returned
 * code, the captured stdout/stderr, and — where a Klein program is involved — the
 * structured `ErrorCode` embedded in the rendered diagnostic, never
 * human-readable message text (per the project quality bar).
 *
 * The dispatch rule under test:
 *   • empty argv + interactive TTY stdin  ⇒ REPL          (return 0)
 *   • any args, OR non-TTY (piped) stdin  ⇒ file runner   (its exit code)
 * Both branches of that `&&`, and the two runner sub-cases, are exercised.
 */

import { describe, expect, it } from "vitest";

import { main, type MainIo, ExitCode } from "../../src/cli/index";

// ─────────────────────────────────────────────────────────────────────────────
// Captured, fully-injected MainIo harness
// ─────────────────────────────────────────────────────────────────────────────

interface Harness {
  readonly io: MainIo;
  /** Everything written to the stdout sink, concatenated. */
  readonly out: () => string;
  /** Everything written to the stderr sink, concatenated. */
  readonly err: () => string;
  /** Observability of which I/O seams the dispatch actually reached. */
  readonly calls: {
    readFile: string[];
    readStdin: number;
    nextLine: number;
  };
}

/** A readFile that serves an in-memory file map and throws ENOENT otherwise. */
function fileReader(files: Record<string, string>): (path: string) => string {
  return (path: string): string => {
    const contents = files[path];
    if (contents === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return contents;
  };
}

/** Deliver `lines` in order via `nextLine()`, then `null` (end-of-input). */
function scriptedLines(
  lines: readonly string[],
  onCall: () => void,
): () => Promise<string | null> {
  const queue = [...lines];
  return (): Promise<string | null> => {
    onCall();
    return Promise.resolve(queue.length > 0 ? (queue.shift() as string) : null);
  };
}

function harness(options?: {
  readonly files?: Record<string, string>;
  readonly stdin?: string;
  readonly lines?: readonly string[];
  readonly stdinIsTTY?: boolean;
  readonly color?: boolean;
  readonly version?: string;
}): Harness {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const calls: Harness["calls"] = { readFile: [], readStdin: 0, nextLine: 0 };

  const readFileImpl = fileReader(options?.files ?? {});

  const io: MainIo = {
    stdout: (text) => stdoutChunks.push(text),
    stderr: (text) => stderrChunks.push(text),
    readFile: (path) => {
      calls.readFile.push(path);
      return readFileImpl(path);
    },
    readStdin: () => {
      calls.readStdin += 1;
      if (options?.stdin === undefined) {
        throw new Error("no stdin was provided to this harness");
      }
      return options.stdin;
    },
    nextLine: scriptedLines(options?.lines ?? [], () => {
      calls.nextLine += 1;
    }),
    stdinIsTTY: options?.stdinIsTTY ?? false,
    color: options?.color ?? false,
    version: options?.version ?? "0.0.0-test",
  };

  return {
    io,
    out: () => stdoutChunks.join(""),
    err: () => stderrChunks.join(""),
    calls,
  };
}

/** The REPL greeting `startRepl` writes first; its presence proves the REPL branch. */
const REPL_BANNER_MARKER = "Klein REPL";

// ─────────────────────────────────────────────────────────────────────────────
// REPL branch: empty argv + interactive stdin
// ─────────────────────────────────────────────────────────────────────────────

describe("main — dispatches a bare interactive invocation to the REPL", () => {
  it("starts the REPL (banner + evaluated program output) and returns 0", async () => {
    const h = harness({
      stdinIsTTY: true,
      lines: ['println("repl-ran");', ".exit"],
    });

    const code = await main([], h.io);

    expect(code).toBe(0);
    // The REPL greeted us and actually evaluated the entry through the pipeline.
    expect(h.out()).toContain(REPL_BANNER_MARKER);
    expect(h.out()).toContain("repl-ran");
    // Dispatch went to the REPL, not the runner: no file/stdin read happened,
    // and the scripted line source WAS consumed.
    expect(h.calls.readFile).toEqual([]);
    expect(h.calls.readStdin).toBe(0);
    expect(h.calls.nextLine).toBeGreaterThan(0);
  });

  it("echoes an expression result across the injected REPL session", async () => {
    const h = harness({ stdinIsTTY: true, lines: ["40 + 2;", ".exit"] });

    const code = await main([], h.io);

    expect(code).toBe(0);
    expect(h.out()).toContain("42");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runner branch: a file argument
// ─────────────────────────────────────────────────────────────────────────────

describe("main — dispatches a file argument to the runner", () => {
  it("runs the file and returns Ok, without ever starting the REPL", async () => {
    const h = harness({
      stdinIsTTY: true, // present-but-irrelevant: args win over the TTY.
      files: { "prog.kl": 'println("file-ran");' },
    });

    const code = await main(["prog.kl"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toContain("file-ran");
    // Proves the runner ran, not the REPL: no banner, no line reads.
    expect(h.out()).not.toContain(REPL_BANNER_MARKER);
    expect(h.calls.nextLine).toBe(0);
    expect(h.calls.readFile).toEqual(["prog.kl"]);
  });

  it("reports a bad program as a structured diagnostic and a non-zero exit", async () => {
    const h = harness({ files: { "bad.kl": "let x = ;" } });

    const code = await main(["bad.kl"], h.io);

    expect(code).toBe(ExitCode.Diagnostics);
    // Keyed off the structured, rendered ErrorCode — never the message text.
    expect(h.err()).toMatch(/error\[E\d+\]/);
    expect(h.out()).not.toContain(REPL_BANNER_MARKER);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runner branch: the empty-argv guard cases (the `&& stdinIsTTY` boundary)
// ─────────────────────────────────────────────────────────────────────────────

describe("main — routes empty argv by whether stdin is interactive", () => {
  it("runs a piped program (no args, non-TTY stdin) via the runner, not the REPL", async () => {
    const h = harness({
      stdinIsTTY: false,
      stdin: 'println("stdin-ran");',
    });

    const code = await main([], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toContain("stdin-ran");
    // Critical: an empty argv with piped stdin is the runner's stdin case, NOT
    // the REPL. The banner must be absent and stdin must have been drained.
    expect(h.out()).not.toContain(REPL_BANNER_MARKER);
    expect(h.calls.readStdin).toBe(1);
    expect(h.calls.nextLine).toBe(0);
  });

  it("passes an informational flag through to the runner even at a TTY", async () => {
    const h = harness({ stdinIsTTY: true, version: "9.9.9" });

    const code = await main(["--version"], h.io);

    expect(code).toBe(ExitCode.Ok);
    // The runner answered --version; the REPL never started despite the TTY.
    expect(h.out()).toBe("9.9.9\n");
    expect(h.calls.nextLine).toBe(0);
  });
});
