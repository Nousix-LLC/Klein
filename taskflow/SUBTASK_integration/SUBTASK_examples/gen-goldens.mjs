/**
 * THROWAWAY golden generator for examples/** (owned by SUBTASK_examples).
 *
 * Not part of the shipped package and deliberately NOT placed under examples/.
 * It drives every example program through the REAL interpreter facade
 * (src/index.ts#interpret) — the exact code path the CLI's runSource uses — and
 * writes each generated golden:
 *
 *   examples/<name>.out    captured stdout (print/println sink), color disabled
 *   examples/<name>.diag   rendered diagnostics (error examples only), NO_COLOR
 *   examples/index.json    machine-readable manifest the E2E suite iterates
 *
 * kind and expectedCodes are DERIVED FROM THE REAL RUN, never hand-authored:
 *   kind          = diagnostics.length > 0 ? "error" : "ok"
 *   expectedCodes = diagnostics.map(d => d.code)   (source order)
 *
 * The .diag byte layout mirrors cli/cli.ts#runSource exactly: for each
 * diagnostic, `formatDiagnostic(d, source, { color:false })` followed by "\n".
 *
 * Run from this workspace:  node gen-goldens.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { tsImport } from "tsx/esm/api";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", ".."); // interpreter/
const examplesDir = resolve(projectRoot, "examples");
const tsconfig = resolve(projectRoot, "tsconfig.json");

// Load the real facade + renderer via tsx so @contracts/@core aliases resolve,
// exactly as bin/klein.mjs does.
const { interpret } = await tsImport("../../src/index.ts", {
  parentURL: import.meta.url,
  tsconfig,
});
const { formatDiagnostic } = await tsImport("../../src/core/index.ts", {
  parentURL: import.meta.url,
  tsconfig,
});

// Curated, ordered set. `name` is the <name> stem; the sourceName is what the
// diagnostics anchor to (matches how the CLI names a file argument).
const NAMES = [
  "fibonacci",
  "fizzbuzz",
  "closures",
  "higher_order",
  "data_structures",
  "strings",
  "errors_undefined",
  "errors_type",
  "errors_divzero",
  "errors_syntax",
];

const manifest = [];

for (const name of NAMES) {
  const klPath = resolve(examplesDir, `${name}.kl`);
  const source = readFileSync(klPath, "utf8");

  // Capture the program's print/println output exactly like the CLI sink.
  let stdout = "";
  const write = (text) => {
    stdout += text;
  };

  // Source name embedded in the `--> name:line:col` locator. Use the canonical
  // REPO-ROOT-RELATIVE path `examples/<name>.kl` so the golden is identical
  // whether the E2E suite renders via `interpret(source, { sourceName })` or
  // spawns the real executable as `node bin/klein.mjs examples/<name>.kl` from
  // the project root (the CLI names a file argument by exactly the path passed).
  const sourceName = `examples/${name}.kl`;
  const outcome = interpret(source, { sourceName, write });

  // .out — captured stdout for EVERY example (may be empty).
  writeFileSync(resolve(examplesDir, `${name}.out`), stdout, "utf8");

  const entry = { name };

  if (outcome.diagnostics.length > 0) {
    entry.kind = "error";
    entry.expectedCodes = outcome.diagnostics.map((d) => d.code);
    // Byte-for-byte identical to `NO_COLOR klein <file>` stderr.
    const diag = outcome.diagnostics
      .map((d) => `${formatDiagnostic(d, source, { color: false })}\n`)
      .join("");
    writeFileSync(resolve(examplesDir, `${name}.diag`), diag, "utf8");
  } else {
    entry.kind = "ok";
  }

  manifest.push(entry);
  const codes = entry.expectedCodes ? ` [${entry.expectedCodes.join(", ")}]` : "";
  console.log(
    `${name.padEnd(18)} kind=${entry.kind.padEnd(5)} out=${stdout.length}B${codes}`,
  );
}

writeFileSync(
  resolve(examplesDir, "index.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`\nWrote index.json with ${manifest.length} entries.`);
