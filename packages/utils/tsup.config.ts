import { defineConfig } from "tsup";

// libphonenumber-js must stay external — it is a `dependency`, which tsup
// externalizes by default. The consumer's bundler has to own it so Vite can
// keep the metadata inside the async chunk created by
// `await import("@repo/utils/phone")`; bundling it here would fuse it to our
// own code and defeat that split.
export default defineConfig({
  // One entry per public subpath. There is no root barrel on purpose: importing
  // `@repo/utils/phone` must never drag a sibling subpath into the bundle.
  entry: {
    phone: "src/phone/index.ts",
  },
  // Dual format is required: apps/api (CommonJS) resolves `require`,
  // apps/web-portal (ESM via Vite) resolves `import`. The package is CommonJS-typed
  // (no `"type"` field), matching @repo/contracts, so `.js` is CJS and `.mjs`
  // is ESM — and a single `.d.ts` serves both.
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  // This package is stored as a Turborepo cache artifact on every build.
  // Sourcemaps would inflate it for no debugging benefit in consumers.
  sourcemap: false,
});
