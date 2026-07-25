import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for NestJS applications.
 *
 * @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        sourceType: "commonjs",
      },
    },
    rules: {
      // NestJS modules are decorator-only classes with no members by design.
      "@typescript-eslint/no-extraneous-class": "off",
      // Decorator metadata relies on parameter properties in constructors.
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    ignores: ["dist/**"],
  },
];
