// Flat ESLint config (ESLint 9 + typescript-eslint 8) — the single lint gate.
// Type-aware linting is enabled via the TypeScript project service, so rules
// like exhaustiveness checking work across the pipeline.
//
// Scope: we lint the Klein package's own authored source only. The read-only
// contracts/ schema and the kernel orchestration scaffolding (SUBTASK_*/) are
// excluded — they are not ours to relint.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import { fileURLToPath } from "node:url";

// Node 18-safe replacement for import.meta.dirname (added in Node 20.11).
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "contracts/**", // read-only vendored contract schema
      "SUBTASK_*/**", // kernel orchestration workspaces (not shipped code)
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      // TypeScript itself resolves identifiers; core no-undef is redundant and
      // misfires on type-only/global references, so typescript-eslint advises
      // disabling it for TS.
      "no-undef": "off",
      // Project bar (see ../_GLOBAL.md §4, ../../_GLOBAL.md §7): no `any` in
      // public surface; prefer discriminated unions + exhaustive switch.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Plain-JS config files (this file included) are not in the tsconfig program:
  // disable type-aware rules and give them the Node global environment.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
