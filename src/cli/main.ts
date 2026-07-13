/**
 * `main` — the Klein command-line entry-point dispatch.
 *
 * This is the one place that decides which of the two user entry points a bare
 * `klein` invocation resolves to, and it is the only `src/cli` module that
 * depends on BOTH siblings (`runCli` from {@link ./cli} and `startRepl` from
 * {@link ./repl}). Keeping the dispatch here — rather than in a sibling — is what
 * let the file runner and the REPL stay decoupled and be built in parallel: each
 * exports one pure, injectable entry function, and `main` composes them.
 *
 * Dispatch rule (exactly the brief's rule):
 *
 *   no runnable args  AND  interactive stdin   ⇒  startRepl   (return 0)
 *   otherwise                                  ⇒  runCli      (return its code)
 *
 * "No runnable args" means an empty argument vector. "Interactive stdin" means
 * stdin is a TTY (a human at a keyboard), not a pipe or a redirected file. The
 * complement cases are deliberately routed to `runCli`, which already owns them:
 *
 *   • args present (`klein file.kl`, `--eval`, `--version`, `--help`, `-`, …)
 *     ⇒ `runCli` parses and executes them.
 *   • no args but stdin is piped (`echo 'print(1)' | klein`)
 *     ⇒ `runCli` reads and runs the piped program (its `stdinIsPiped` branch).
 *
 * Only the truly empty-argv + interactive-terminal case is the REPL — which is
 * the intuitive behavior: typing `klein` at a shell prompt drops you into the
 * interactive session.
 *
 * `main` performs **no ambient I/O**. Every real capability (writing to stdout /
 * stderr, reading a file, draining stdin, reading a line, the TTY probe, the
 * package version) is injected through {@link MainIo}; binding those to the real
 * `process` / `fs` / `readline` handles is the executable entry's job
 * (`bin/klein.mjs`). That injection seam is what makes the dispatch — including
 * both branches — deterministically testable without spawning a process.
 *
 * This module carries real logic and is therefore intentionally NOT an
 * `index.ts` barrel: `vitest.config.ts` excludes `src/**\/index.ts` from
 * coverage as pure re-export barrels, so the dispatch lives here (and is
 * re-exported by `src/cli/index.ts`) to keep it inside the coverage gate.
 */

import { runCli, type CliIo } from "./cli";
import { startRepl, type ReplIo } from "./repl";

/**
 * The complete, injected I/O surface `main` dispatches over — a superset of what
 * `runCli` ({@link CliIo}) and `startRepl` ({@link ReplIo}) each require. `main`
 * projects the relevant subset onto whichever entry point it selects, so the two
 * siblings never learn about each other's I/O shape.
 */
export interface MainIo {
  /** Sink for all standard output (program output, banners, `--version`, `--help`). */
  readonly stdout: (text: string) => void;
  /** Sink for standard error (rendered diagnostics, usage/I-O errors). */
  readonly stderr: (text: string) => void;
  /**
   * Read a source file's full UTF-8 text. MUST throw when the path is missing or
   * unreadable; `runCli` catches the throw and reports a usage/I-O error.
   */
  readonly readFile: (path: string) => string;
  /** Read all of standard input as UTF-8 (for `-` and piped, non-interactive input). */
  readonly readStdin: () => string;
  /**
   * Read the next line of interactive input WITHOUT its trailing newline, or
   * `null` at end-of-input. Used only by the REPL branch.
   */
  readonly nextLine: () => Promise<string | null>;
  /**
   * Whether standard input is an interactive TTY (a human at a keyboard) rather
   * than a pipe or a redirected file. This single flag drives both the REPL
   * dispatch decision and `runCli`'s `stdinIsPiped` (its logical complement).
   */
  readonly stdinIsTTY: boolean;
  /** Whether diagnostics should render with ANSI colour (decided from the real TTY in `bin`). */
  readonly color: boolean;
  /** The package version string, for `--version`. */
  readonly version: string;
}

/**
 * Dispatch a Klein command-line invocation to the REPL or the file runner.
 *
 * @param argv the user arguments (the vector AFTER the node/executable prefix,
 *   i.e. what the executable obtains from `process.argv.slice(2)`)
 * @param io   the injected I/O surface (see {@link MainIo})
 * @returns the process exit code — `0` for a completed REPL session, otherwise
 *   whatever {@link runCli} returns (`0` ok, `1` diagnostics, `2` usage/I-O)
 */
export async function main(
  argv: readonly string[],
  io: MainIo,
): Promise<number> {
  // The REPL is reached only by a bare, interactive `klein`. Everything else —
  // any argument at all, or piped/redirected stdin — is the runner's job.
  if (argv.length === 0 && io.stdinIsTTY) {
    const replIo: ReplIo = {
      stdout: io.stdout,
      stderr: io.stderr,
      nextLine: io.nextLine,
      color: io.color,
    };
    await startRepl(replIo);
    return 0;
  }

  const cliIo: CliIo = {
    stdout: io.stdout,
    stderr: io.stderr,
    readFile: io.readFile,
    readStdin: io.readStdin,
    // A non-TTY stdin is "piped" from the runner's perspective: it may be drained
    // for `-` or an argument-less piped program.
    stdinIsPiped: !io.stdinIsTTY,
    color: io.color,
    version: io.version,
  };
  return runCli(argv, cliIo);
}
