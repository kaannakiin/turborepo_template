import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per public subpath. There is no root barrel on purpose: importing
  // `@repo/i18n/locale` must never drag i18next or the translation resources
  // into the bundle — CJS consumers (Nest) get no tree-shaking at require time.
  entry: {
    locale: "src/locale.ts",
    instance: "src/instance.ts",
    zod: "src/zod/index.ts",
  },
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  sourcemap: false,
});
