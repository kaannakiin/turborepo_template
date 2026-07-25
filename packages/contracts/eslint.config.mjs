import { config, browserSafe } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  // Contracts ship to apps/web, so they inherit the browser rules: only
  // `@repo/database/enums` and `/models` may cross this boundary.
  ...browserSafe,
];
