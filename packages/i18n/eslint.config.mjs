import { config, browserSafe } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  // Locale resources and the zod error map ship to apps/web too, so the
  // package must stay free of Node-only imports.
  ...browserSafe,
];
