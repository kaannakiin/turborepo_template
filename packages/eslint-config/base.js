import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];

/**
 * Guard for every package whose code can end up in a browser bundle
 * (`apps/web-portal`, `packages/contracts`).
 *
 * `@repo/database` already blocks this at resolution time via the `browser`
 * export condition, but that failure surfaces late — during a Vite build, in a
 * stack trace. This makes it a lint error at the import site instead.
 *
 * Note: the repo loads `eslint-plugin-only-warn`, which downgrades every error
 * to a warning. That is fine — the `lint` script runs with `--max-warnings 0`,
 * so a violation still fails the task.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const browserSafe = [
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@repo/database/server",
                "@repo/database/dist/*",
                "@prisma/client",
                "@prisma/client/*",
                "@prisma/adapter-*",
                "pg",
              ],
              message:
                "Server-only. Browser-facing code may import @repo/database/enums (runtime values) or @repo/database/models (types) — nothing else.",
            },
            {
              group: ["@repo/contracts/solutions/*"],
              message:
                "This app is a control-plane client. A solution's contracts belong to that solution's own frontend; importing them here is what makes the portal grow a second product's vocabulary.",
            },
            {
              group: ["@repo/utils/*"],
              message:
                'Statically importing @repo/utils/phone pulls libphonenumber-js metadata into the entry bundle. Reach it through `await import("@repo/utils/phone")` instead — no-restricted-imports does not flag dynamic imports. packages/contracts must not reference it at all; the metadata-backed check is injected via createRegisterRequestSchema({ isValidPhone }).',
            },
          ],
        },
      ],
    },
  },
];
