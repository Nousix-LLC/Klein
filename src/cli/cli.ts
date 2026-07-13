/**
 * `runCli` — the Klein file runner.
 *
 * A single **pure, injectable** function that parses command-line arguments,
 * drives Klein source through the {@link interpret} facade, renders any
 * diagnostics through the shared `@core` renderer, and returns a process exit
 * code. It performs **no ambient I/O**: every side channel (stdout, stderr,
 * reading a file, reading stdin, the package version, the color decision) arrives
 * through the injected {@link CliIo}. Binding the real `process`/`fs` handles is
 * the executable entry's job (`bin/klein.mjs` via `main`), never this module's —
 * which is exactly what keeps the runner deterministically testable.
 *
 * `runCli` deliberately does NOT own:
 *   - `process.exit` — it *returns* the exit code; `bin` exits with it.
 *   - the no-args ⇒ REPL dispatch — that is `main`'s job (the `synthesis` task).
 *     By the time `runCli` is called there is something to run (a file, an
 *     `--eval` string, or piped/`-` stdin), or the invocation is a usage error.
 *
 * Argument grammar (hand-rolled; zero runtime dependencies — see the task
 * completion record for the dependency justification):
 *
 *   klein <file.kl>          run a program from a file
 *   klein --eval "<code>"    run a literal program string        (alias: -e, --eval=<code>)
 *   klein -                  run the program read from stdin
 *   klein                    with piped stdin: run stdin; otherwise a usage error
 *   klein --version          print the version and exit          (alias: -v)
 *   klein --help             print usage and exit                (alias: -h)
 *
 * Exit codes ({@link ExitCode}): `0` success, `1` the program emitted one or more
 * diagnostics, `2` a usage or I/O error (bad flags, missing file, conflicting
 * modes). The scheme is conventional (`2` = misuse of the command).
 */

import { type Diagnostic } from "@contracts";
import { formatDiagnostic } from "@core";

import { interpret } from "../index";

/**
 * The injected I/O surface `runCli` operates through. Every member is a seam a
 * test can substitute; the real bindings (`process.stdout.write`,
 * `fs.readFileSync`, the TTY probe, the `package.json` version) are supplied by
 * the executable entry, never reached for here.
 */
export interface CliIo {
  /** Sink for program output, `--help`, and `--version`. */
  readonly stdout: (text: string) => void;
  /** Sink for rendered diagnostics and usage/I/O error messages. */
  readonly stderr: (text: string) => void;
  /**
   * Read a source file's full text (UTF-8). MUST throw when the path is missing
   * or unreadable; `runCli` catches the throw and reports it as a usage/I/O
   * error. The thrown value's `message` (when it is an `Error`) is surfaced.
   */
  readonly readFile: (path: string) => string;
  /** Read all of standard input as UTF-8 (used for `-` and piped input). */
  readonly readStdin: () => string;
  /**
   * Whether standard input is piped (i.e. not an interactive TTY). When true and
   * no file/`--eval` is given, `runCli` reads the program from stdin; when false,
   * an argument-less invocation is a usage error (the REPL branch is `main`'s).
   */
  readonly stdinIsPiped: boolean;
  /**
   * Whether diagnostics should render with ANSI color. The TTY check that decides
   * this happens in `bin`/`main` and is passed in here — `runCli` never probes a
   * stream directly.
   */
  readonly color: boolean;
  /** The package version, for `--version`. Sourced from `package.json` by `main`. */
  readonly version: string;
}

/** Process exit codes `runCli` returns. Stable, structured, and documented. */
export enum ExitCode {
  /** The run completed with no diagnostics of any phase. */
  Ok = 0,
  /** The program produced one or more diagnostics (lexical, syntax, or runtime). */
  Diagnostics = 1,
  /** A usage or I/O error: bad/conflicting flags, missing argument, unreadable input. */
  Usage = 2,
}

/**
 * The parsed intent of an argv vector — what the user asked the CLI to do. A
 * small discriminated union so parsing (pure, total, no I/O) is cleanly separated
 * from execution (which touches the injected I/O).
 */
type Intent =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | { readonly kind: "eval"; readonly code: string }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "stdin" }
  | { readonly kind: "usage"; readonly message: string };

/** The logical source name shown in diagnostics for a literal `--eval` program. */
const EVAL_SOURCE_NAME = "<eval>";
/** The logical source name shown in diagnostics for a program read from stdin. */
const STDIN_SOURCE_NAME = "<stdin>";

/** Concise usage text, appended to usage errors and shown by `--help`. */
const USAGE = `Usage:
  klein <file.kl>          Run a Klein program from a file.
  klein --eval "<code>"    Run a literal program string.   (aliases: -e, --eval=<code>)
  klein -                  Run the program read from standard input.
  klein                    With piped stdin, run stdin; with no args, start the REPL.
  klein --version          Print the version and exit.      (alias: -v)
  klein --help             Show this help and exit.         (alias: -h)

Exit codes:
  0  success (no diagnostics)
  1  the program produced one or more diagnostics
  2  usage or I/O error`;

/**
 * Run Klein from the command line.
 *
 * @param argv the user arguments (the vector *after* the node/executable prefix,
 *   i.e. what `main` obtains from `process.argv.slice(2)`)
 * @param io   the injected I/O surface (see {@link CliIo})
 * @returns the process exit code (see {@link ExitCode}); this function never
 *   calls `process.exit` and never writes anywhere but through `io`
 */
export function runCli(argv: readonly string[], io: CliIo): number {
  const intent = parseArgs(argv, io.stdinIsPiped);

  switch (intent.kind) {
    case "help":
      io.stdout(`${USAGE}\n`);
      return ExitCode.Ok;

    case "version":
      io.stdout(`${io.version}\n`);
      return ExitCode.Ok;

    case "usage":
      io.stderr(`error: ${intent.message}\n\n${USAGE}\n`);
      return ExitCode.Usage;

    case "eval":
      return runSource(intent.code, EVAL_SOURCE_NAME, io);

    case "stdin": {
      const source = readOrReport(() => io.readStdin(), "standard input", io);
      return source === null
        ? ExitCode.Usage
        : runSource(source, STDIN_SOURCE_NAME, io);
    }

    case "file": {
      const source = readOrReport(
        () => io.readFile(intent.path),
        intent.path,
        io,
      );
      return source === null
        ? ExitCode.Usage
        : runSource(source, intent.path, io);
    }
  }
}

/**
 * Parse `argv` into a single {@link Intent}. Pure and total: it performs no I/O
 * and always classifies the input (an unrecognized or contradictory invocation
 * becomes a `usage` intent rather than throwing).
 */
function parseArgs(argv: readonly string[], stdinIsPiped: boolean): Intent {
  let help = false;
  let version = false;
  let evalCode: string | undefined;
  let stdinDash = false;
  let optionsEnded = false;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";

    if (optionsEnded) {
      files.push(arg);
      continue;
    }

    // A bare "-" means "read from stdin"; it is not a flag.
    if (arg === "-") {
      stdinDash = true;
      continue;
    }

    // "--" ends option parsing; every later token is a positional.
    if (arg === "--") {
      optionsEnded = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      version = true;
      continue;
    }

    if (arg === "--eval" || arg === "-e") {
      const value = argv[i + 1];
      if (value === undefined) {
        return usage(`${arg} requires an argument`);
      }
      evalCode = value;
      i++; // consume the value token
      continue;
    }

    if (arg.startsWith("--eval=")) {
      evalCode = arg.slice("--eval=".length);
      continue;
    }

    // Any other token that looks like an option is unrecognized. A non-option
    // token is a positional (a file path).
    if (arg.startsWith("-") && arg.length > 1) {
      return usage(`unknown option '${arg}'`);
    }

    files.push(arg);
  }

  // Informational flags win, so `--help`/`--version` are always answerable even
  // alongside other tokens. `--help` takes precedence over `--version`.
  if (help) return { kind: "help" };
  if (version) return { kind: "version" };

  // Exactly one run mode may be selected. Reject contradictory combinations
  // explicitly rather than silently preferring one.
  if (evalCode !== undefined) {
    if (files.length > 0) {
      return usage("cannot combine --eval with a file argument");
    }
    if (stdinDash) {
      return usage("cannot combine --eval with reading from stdin");
    }
    return { kind: "eval", code: evalCode };
  }

  if (stdinDash) {
    if (files.length > 0) {
      return usage("cannot combine '-' (stdin) with a file argument");
    }
    return { kind: "stdin" };
  }

  if (files.length > 1) {
    return usage("expected a single file argument");
  }

  if (files.length === 1) {
    return { kind: "file", path: files[0] ?? "" };
  }

  // No explicit input. If stdin is piped, run it; otherwise there is nothing to
  // do here (an interactive no-args invocation is the REPL, dispatched by main).
  if (stdinIsPiped) return { kind: "stdin" };
  return usage(
    "no input: provide a file, --eval <code>, or pipe a program on stdin",
  );
}

/** Build a `usage` intent carrying `message`. */
function usage(message: string): Intent {
  return { kind: "usage", message };
}

/**
 * Read a source via `read`, reporting a failure as a usage/I/O error on stderr.
 *
 * @returns the source text, or `null` when the read threw (already reported)
 */
function readOrReport(
  read: () => string,
  what: string,
  io: CliIo,
): string | null {
  try {
    return read();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`error: could not read ${what}: ${detail}\n`);
    return null;
  }
}

/**
 * Run one resolved program: drive it through {@link interpret} (routing its
 * `print`/`println` output to `io.stdout`), render any diagnostics to
 * `io.stderr`, and map the outcome to an exit code.
 */
function runSource(source: string, sourceName: string, io: CliIo): number {
  const outcome = interpret(source, { sourceName, write: io.stdout });

  if (outcome.diagnostics.length > 0) {
    for (const diagnostic of outcome.diagnostics) {
      io.stderr(`${renderDiagnostic(diagnostic, source, io.color)}\n`);
    }
    return ExitCode.Diagnostics;
  }

  return ExitCode.Ok;
}

/** Render one diagnostic through the shared `@core` renderer (never reimplemented). */
function renderDiagnostic(
  diagnostic: Diagnostic,
  source: string,
  color: boolean,
): string {
  return formatDiagnostic(diagnostic, source, { color });
}
