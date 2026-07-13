import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runtime half of the path-alias contract (the compile-time half is tsconfig
// `paths`). Vitest/Vite must be told the aliases explicitly; this is what makes
// `import { Token } from "@contracts"` resolve when tests run.
const resolvePath = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@contracts$/,
        replacement: resolvePath("./contracts/index.ts"),
      },
      { find: /^@contracts\//, replacement: resolvePath("./contracts/") },
      { find: /^@core$/, replacement: resolvePath("./src/core/index.ts") },
      { find: /^@core\//, replacement: resolvePath("./src/core/") },
    ],
  },
  test: {
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    environment: "node",
    // Green on an empty repo; real suites arrive with each pipeline stage.
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/**/index.ts", // re-export barrels carry no logic
        "src/**/*.d.ts",
      ],
      // Project quality bar (../../_GLOBAL.md §9): >= 90% line coverage on src/.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
