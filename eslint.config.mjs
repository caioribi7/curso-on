import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain-node SQL test harness (assertion-style ternaries).
    "supabase/tests/**",
    // Agent worktrees and scratch files are not part of the app.
    ".claude/**",
    "cli/target/**",
  ]),
]);

export default eslintConfig;
