import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per public subpath. There is no root barrel on purpose: importing
  // `@repo/contracts/shared` must never drag `admin` into the bundle.
  entry: {
    shared: "src/shared/index.ts",
    auth: "src/auth/index.ts",
    admin: "src/admin/index.ts",
  },
  // Dual format is required: apps/api (CommonJS) resolves `require`,
  // apps/web (ESM via Vite) resolves `import`. The package itself is
  // CommonJS-typed (no `"type"` field), matching @repo/database, so `.js` is
  // CJS and `.mjs` is ESM — and a single `.d.ts` serves both.
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
  dts: true,
  // Code shared between entries (role.contract) lands in one chunk instead of
  // being duplicated into each of them.
  splitting: true,
  treeshake: true,
  clean: true,
  // This package is stored as a Turborepo cache artifact on every build.
  // Sourcemaps would inflate it for no debugging benefit in consumers.
  sourcemap: false,
});
