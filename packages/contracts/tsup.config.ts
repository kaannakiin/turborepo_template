import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // Dual format is required: apps/api (CommonJS) resolves `require`,
  // apps/web (ESM via Vite) resolves `import`.
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  dts: true,
  clean: true,
  // This package is stored as a Turborepo cache artifact on every build.
  // Sourcemaps would inflate it for no debugging benefit in consumers.
  sourcemap: false,
});
