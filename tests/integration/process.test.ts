/**
 * True-process end-to-end smoke tests for the shipped executable `bin/klein.mjs`.
 *
 * The other suites drive the in-process `interpret()` facade; this one spawns the
 * REAL `bin` (`node bin/klein.mjs <file>` via `tsx`) so the package's advertised
 * entry point — argument handling, file reading, the tsx loader, stdout/stderr
 * split, and process exit code — is proven end-to-end, not just the library facade.
 *
 * `tsx` cold-start is not free, so this is deliberately limited to two
 * representative spawns — one `ok` program (proving the success path: stdout +
 * exit 0) and one `error` program (proving the failure path: rendered diagnostic
 * on stderr + a non-zero exit) — rather than the whole manifest. The in-process
 * suites cover every example exhaustively.
 */

import { describe, expect, it } from "vitest";

import {
  readDiagGolden,
  readOutGolden,
  sourceNameFor,
  spawnKlein,
} from "./harness";

// tsx has to compile the TypeScript entry on first load; give the spawns headroom.
const SPAWN_TIMEOUT_MS = 30_000;

describe("bin/klein.mjs — true child-process end-to-end", () => {
  it(
    "runs an ok example: golden stdout, empty stderr, exit 0",
    () => {
      const name = "fibonacci";
      const run = spawnKlein(sourceNameFor(name));

      expect(run.status).toBe(0);
      expect(run.stdout).toBe(readOutGolden(name));
      expect(run.stderr).toBe("");
    },
    SPAWN_TIMEOUT_MS,
  );

  it(
    "runs an error example: rendered diagnostic on stderr, exit 1",
    () => {
      const name = "errors_undefined";
      const run = spawnKlein(sourceNameFor(name));

      // Exit 1 = diagnostics (0 ok / 1 diagnostics / 2 usage-or-I/O).
      expect(run.status).toBe(1);
      // Program output (if any) goes to stdout; the diagnostic goes to stderr.
      expect(run.stdout).toBe(readOutGolden(name));
      // The CLI's stderr is exactly how the .diag golden was generated.
      expect(run.stderr).toBe(readDiagGolden(name));
      // And it is a real structured, source-anchored diagnostic (not message text).
      expect(run.stderr).toMatch(/error\[E\d{4}\]/);
      expect(run.stderr).toContain("-->");
    },
    SPAWN_TIMEOUT_MS,
  );
});
