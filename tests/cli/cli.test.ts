/**
 * Tests for the Klein file runner (`runCli`, `src/cli/cli.ts`).
 *
 * `runCli` is a **pure, injectable** function: it takes an argv vector and a
 * {@link CliIo} and returns a process exit code, doing no ambient I/O. Every test
 * here drives it through a captured fake `CliIo` — asserting the returned
 * {@link ExitCode}, the text captured on the injected stdout/stderr sinks, and,
 * where a Klein program is involved, the structured `ErrorCode` embedded in the
 * rendered diagnostic (`error[E3001]…`) rather than any human-readable message
 * text (per the project quality bar).
 */

import { describe, expect, it, vi } from "vitest";

import { ErrorCode } from "../../src/index";
import { type CliIo, ExitCode, runCli } from "../../src/cli/cli";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness: a captured, fully-injected CliIo
// ─────────────────────────────────────────────────────────────────────────────

interface Harness {
  readonly io: CliIo;
  /** Everything written to the stdout sink, concatenated. */
  readonly out: () => string;
  /** Everything written to the stderr sink, concatenated. */
  readonly err: () => string;
}

/** A default readFile that serves an in-memory file map and throws ENOENT otherwise. */
function fileReader(files: Record<string, string>): (path: string) => string {
  return (path: string): string => {
    const contents = files[path];
    if (contents === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return contents;
  };
}

function harness(options?: {
  readonly files?: Record<string, string>;
  readonly stdin?: string;
  readonly stdinIsPiped?: boolean;
  readonly color?: boolean;
  readonly version?: string;
  readonly readFile?: (path: string) => string;
  readonly readStdin?: () => string;
}): Harness {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const io: CliIo = {
    stdout: (text) => stdoutChunks.push(text),
    stderr: (text) => stderrChunks.push(text),
    readFile: options?.readFile ?? fileReader(options?.files ?? {}),
    readStdin:
      options?.readStdin ??
      ((): string => {
        if (options?.stdin === undefined) {
          throw new Error("no stdin provided to this test harness");
        }
        return options.stdin;
      }),
    stdinIsPiped: options?.stdinIsPiped ?? false,
    color: options?.color ?? false,
    version: options?.version ?? "0.0.0-test",
  };

  return {
    io,
    out: () => stdoutChunks.join(""),
    err: () => stderrChunks.join(""),
  };
}

/** The bracketed structured-code marker the shared renderer emits in a header. */
function codeMarker(code: ErrorCode): string {
  return `[${code}]`;
}

// ─────────────────────────────────────────────────────────────────────────────
// File mode
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — file mode", () => {
  it("runs a file, prints its output to stdout, and returns Ok", () => {
    const h = harness({ files: { "prog.kl": 'println("hi");' } });

    const code = runCli(["prog.kl"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("hi\n");
    expect(h.err()).toBe("");
  });

  it("reports a missing file as a usage/I/O error (exit 2), nothing on stdout", () => {
    const h = harness({ files: {} });

    const code = runCli(["nope.kl"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.out()).toBe("");
    expect(h.err()).toContain("could not read nope.kl");
  });

  it("renders a runtime diagnostic to stderr (keyed off ErrorCode) and returns Diagnostics", () => {
    const h = harness({ files: { "prog.kl": "missing;" } });

    const code = runCli(["prog.kl"], h.io);

    expect(code).toBe(ExitCode.Diagnostics);
    // Structured code, not message text; and it is source-anchored at the file.
    expect(h.err()).toContain(codeMarker(ErrorCode.UndefinedVariable));
    expect(h.err()).toContain("prog.kl");
    expect(h.err()).toContain("-->");
  });

  it("rejects more than one file argument (exit 2)", () => {
    const h = harness({ files: { "a.kl": "1;", "b.kl": "2;" } });

    const code = runCli(["a.kl", "b.kl"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("single file");
  });

  it("treats tokens after '--' as file paths, even option-looking ones", () => {
    const h = harness({ files: { "-weird.kl": 'println("ok");' } });

    const code = runCli(["--", "-weird.kl"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("ok\n");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --eval mode
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — --eval mode", () => {
  it("runs a literal program and returns Ok", () => {
    const h = harness();

    const code = runCli(["--eval", 'print("x");'], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("x");
    expect(h.err()).toBe("");
  });

  it("supports the -e alias", () => {
    const h = harness();

    const code = runCli(["-e", 'print("y");'], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("y");
  });

  it("supports the --eval=<code> form", () => {
    const h = harness();

    const code = runCli(['--eval=print("z");'], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("z");
  });

  it("errors (exit 2) when --eval is given no argument", () => {
    const h = harness();

    const code = runCli(["--eval"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("requires an argument");
  });

  it("renders a lexical diagnostic under the <eval> source name (keyed off ErrorCode)", () => {
    const h = harness();

    const code = runCli(["--eval", "@"], h.io);

    expect(code).toBe(ExitCode.Diagnostics);
    expect(h.err()).toContain(codeMarker(ErrorCode.UnexpectedCharacter));
    expect(h.err()).toContain("<eval>");
  });

  it("renders a syntax diagnostic (keyed off ErrorCode) and returns Diagnostics", () => {
    const h = harness();

    const code = runCli(["--eval", "let x = 5"], h.io);

    expect(code).toBe(ExitCode.Diagnostics);
    expect(h.err()).toContain(codeMarker(ErrorCode.ExpectedToken));
  });

  it("prints program output to stdout even when a later runtime error occurs", () => {
    const h = harness();

    const code = runCli(["--eval", 'println("before"); missing;'], h.io);

    expect(code).toBe(ExitCode.Diagnostics);
    expect(h.out()).toBe("before\n"); // stdout: program output only
    expect(h.err()).toContain(codeMarker(ErrorCode.UndefinedVariable)); // stderr: diagnostic
  });

  it("rejects combining --eval with a file argument (exit 2)", () => {
    const h = harness({ files: { "a.kl": "1;" } });

    const code = runCli(["--eval", "1;", "a.kl"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("cannot combine --eval with a file");
  });

  it("rejects combining --eval with '-' stdin (exit 2)", () => {
    const h = harness();

    const code = runCli(["--eval", "1;", "-"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("cannot combine --eval with reading from stdin");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stdin mode
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — stdin mode", () => {
  it("runs the program read from '-' and returns Ok", () => {
    const h = harness({ stdin: 'print("piped");' });

    const code = runCli(["-"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("piped");
  });

  it("runs piped stdin when invoked with no arguments (stdin not a TTY)", () => {
    const h = harness({ stdin: 'print("auto");', stdinIsPiped: true });

    const code = runCli([], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("auto");
  });

  it("renders a stdin diagnostic under the <stdin> source name", () => {
    const h = harness({ stdin: "missing;" });

    const code = runCli(["-"], h.io);

    expect(code).toBe(ExitCode.Diagnostics);
    expect(h.err()).toContain(codeMarker(ErrorCode.UndefinedVariable));
    expect(h.err()).toContain("<stdin>");
  });

  it("reports a stdin read failure as a usage/I/O error (exit 2)", () => {
    const h = harness({
      readStdin: () => {
        throw new Error("EIO: stdin unreadable");
      },
    });

    const code = runCli(["-"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("could not read standard input");
  });

  it("rejects combining '-' stdin with a file argument (exit 2)", () => {
    const h = harness({ files: { "a.kl": "1;" }, stdin: "1;" });

    const code = runCli(["-", "a.kl"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("cannot combine '-' (stdin) with a file");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --version / --help
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — informational flags", () => {
  it("--version prints the injected version and returns Ok", () => {
    const h = harness({ version: "1.2.3" });

    const code = runCli(["--version"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toBe("1.2.3\n");
    expect(h.err()).toBe("");
  });

  it("supports the -v version alias", () => {
    const h = harness({ version: "4.5.6" });

    expect(runCli(["-v"], h.io)).toBe(ExitCode.Ok);
    expect(h.out()).toBe("4.5.6\n");
  });

  it("--help prints usage to stdout and returns Ok", () => {
    const h = harness();

    const code = runCli(["--help"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toContain("Usage:");
    expect(h.err()).toBe("");
  });

  it("supports the -h help alias", () => {
    const h = harness();

    expect(runCli(["-h"], h.io)).toBe(ExitCode.Ok);
    expect(h.out()).toContain("Usage:");
  });

  it("lets --help win when combined with other tokens", () => {
    const h = harness({ files: { "a.kl": "1;" } });

    // --help is answerable even alongside a would-be file/eval; it must not run them.
    const code = runCli(["a.kl", "--help"], h.io);

    expect(code).toBe(ExitCode.Ok);
    expect(h.out()).toContain("Usage:");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Usage errors
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — usage errors", () => {
  it("rejects an unknown option (exit 2) and echoes it", () => {
    const h = harness();

    const code = runCli(["--bogus"], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("unknown option '--bogus'");
    expect(h.err()).toContain("Usage:"); // usage text appended to the error
  });

  it("is a usage error when invoked with no args and stdin is a TTY", () => {
    const h = harness({ stdinIsPiped: false });

    const code = runCli([], h.io);

    expect(code).toBe(ExitCode.Usage);
    expect(h.err()).toContain("no input");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Color threading (TTY decision is injected, never probed)
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — color", () => {
  it("emits ANSI color in diagnostics when io.color is true", () => {
    const h = harness({ color: true });

    runCli(["--eval", "@"], h.io);

    // eslint-disable-next-line no-control-regex
    expect(h.err()).toMatch(/\x1b\[/);
  });

  it("emits no ANSI color in diagnostics when io.color is false", () => {
    const h = harness({ color: false });

    runCli(["--eval", "@"], h.io);

    // eslint-disable-next-line no-control-regex
    expect(h.err()).not.toMatch(/\x1b\[/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Purity: no ambient I/O, exit code is only returned
// ─────────────────────────────────────────────────────────────────────────────

describe("runCli — purity", () => {
  it("never touches the real process.stdout / process.exit", () => {
    const h = harness({ files: { "prog.kl": 'println("ok");' } });
    const stdoutSpy = vi.spyOn(process.stdout, "write");
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((): never => undefined as never);

    try {
      const code = runCli(["prog.kl"], h.io);
      expect(code).toBe(ExitCode.Ok);
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
