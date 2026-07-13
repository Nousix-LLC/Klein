#!/usr/bin/env node
/**
 * bin/klein.mjs — the Klein executable entry (the package `bin`).
 *
 * This is the deliberately THIN shim at the edge of the program. It owns exactly
 * the things that must touch the real world and nothing that deserves a test:
 *
 *   1. Load the TypeScript entry through tsx's esbuild runtime. `tsc` is a
 *      type-check gate only (`noEmit`), and the read-only `contracts/` use
 *      extensionless + path-aliased imports (`@contracts`, `@core`) that plain
 *      Node ESM cannot resolve — so the shipped runtime runs the sources
 *      directly via tsx (see scaffold/tsconfig notes). We point tsx at the
 *      project `tsconfig.json` so the aliases resolve no matter the caller's cwd
 *      (a local `node bin/klein.mjs`, an `npx klein`, or a global install).
 *   2. Bind the real capabilities — `process.stdout`/`stderr`, `fs` reads, a
 *      `readline` line source, the TTY colour probe, the package version — into
 *      the injected I/O surface `main` dispatches over.
 *   3. Call `main`, then `process.exit` with the code it returns.
 *
 * All testable behaviour lives in `main` (dispatch) and the sibling entry
 * functions (`runCli`, `startRepl`), each covered through injected I/O. This file
 * has no Klein logic to test, which is why it is a `.mjs` shim outside `src/`.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { tsImport } from "tsx/esm/api";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

// Run the TS entry via tsx, giving it the project tsconfig so `@contracts` /
// `@core` path aliases resolve independently of the working directory.
const { main } = await tsImport("../src/cli/index.ts", {
  parentURL: import.meta.url,
  tsconfig: resolve(packageRoot, "tsconfig.json"),
});

const io = {
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
  readFile: (path) => readFileSync(path, "utf8"),
  // Drain all of fd 0 for `-` / piped input. Never reached on the REPL branch.
  readStdin: () => readFileSync(0, "utf8"),
  nextLine: makeLineReader(),
  stdinIsTTY: process.stdin.isTTY === true,
  // Colour only for a real terminal, and honour the NO_COLOR convention.
  color: process.stdout.isTTY === true && !process.env.NO_COLOR,
  version: readPackageVersion(),
};

const code = await main(process.argv.slice(2), io);
process.exit(code);

// ── binding helpers (real process/fs/readline only; no Klein logic) ──────────

/** Read the shipped package version from package.json, defensively. */
function readPackageVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Build the REPL's `nextLine()` over the real stdin using `readline`. The
 * interface is created lazily on first call, so the file-runner path never opens
 * a reader on stdin (which would otherwise contend with `readStdin`). Each call
 * resolves to the next line (newline stripped) or `null` at end-of-input.
 */
function makeLineReader() {
  let reader;
  const buffered = [];
  const waiters = [];
  let ended = false;

  const start = () => {
    if (reader) return;
    reader = createInterface({ input: process.stdin, terminal: false });
    reader.on("line", (line) => {
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else buffered.push(line);
    });
    reader.on("close", () => {
      ended = true;
      for (const waiter of waiters.splice(0)) waiter(null);
    });
  };

  return () => {
    start();
    if (buffered.length > 0) return Promise.resolve(buffered.shift());
    if (ended) return Promise.resolve(null);
    return new Promise((res) => waiters.push(res));
  };
}
