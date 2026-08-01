import { config, browserSafe } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  // This package ships to apps/web-portal, so it inherits the browser rules.
  ...browserSafe,
];
