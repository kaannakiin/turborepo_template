import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per public subpath. There is no root barrel on purpose: importing
  // `@repo/contracts/shared` must never drag `control-plane/platform` into the
  // bundle. A slash in an entry key becomes an output subdirectory, so the
  // plane prefix survives into `dist/` and into the `exports` map unchanged.
  entry: {
    shared: "src/shared/index.ts",
    "control-plane/identity": "src/control-plane/identity/index.ts",
    "control-plane/tenancy": "src/control-plane/tenancy/index.ts",
    "control-plane/access": "src/control-plane/access/index.ts",
    "control-plane/platform": "src/control-plane/platform/index.ts",
  },
  // Dual format is required: apps/api (CommonJS) resolves `require`,
  // apps/web-portal (ESM via Vite) resolves `import`. The package itself is
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
