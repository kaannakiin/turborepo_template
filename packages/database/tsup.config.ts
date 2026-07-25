import { defineConfig } from "tsup";

// Only the browser-safe entries get an ESM mirror. Without it, Vite would pull
// the CommonJS build into the client bundle and lose tree shaking on the enums.
// The server entry is intentionally CJS-only: `apps/api` (NestJS + SWC) is its
// sole runtime consumer, which keeps the generated client's `__dirname` usage
// valid and avoids emitting an ESM copy that would need `import.meta.url`.
export default defineConfig({
  entry: {
    enums: "src/enums.ts",
    models: "src/models.ts",
  },
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  // Declarations come from `tsc -p tsconfig.build.json`, which runs first.
  dts: false,
  clean: false,
  sourcemap: false,
  treeshake: true,
});
