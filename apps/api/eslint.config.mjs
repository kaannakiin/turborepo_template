import { config } from "@repo/eslint-config/nest";
import { apiPlanes } from "@repo/eslint-config/planes";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  ...apiPlanes,
  {
    // Second gate for the test-only `@api/*` alias. tsconfig.json already
    // fails to resolve it inside `src` (TS2307), but that error names a
    // missing module rather than the rule that was broken.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@api", "@api/*"],
              message:
                "The @api/* alias is mapped by tsconfig.test.json and jest's moduleNameMapper only. `src` is compiled by SWC, which does not rewrite the specifier, so it would survive into dist and fail at runtime. Use a relative import.",
            },
          ],
        },
      ],
    },
  },
];
